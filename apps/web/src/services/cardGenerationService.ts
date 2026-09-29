import { cardsRepository, membersRepository } from "@/repositories";
import type { MembershipCardRecord, Member, PublicUser } from "@amococ/shared";
import { createId } from "@/utils/id";
import { auditService } from "./auditService";
import { authorizationService } from "./authorizationService";
import { imageService } from "./imageService";
import { membershipCardCodeService } from "./membershipCardCodeService";
import { settingsService } from "./settingsService";
import { signatureService } from "./signatureService";

export class SignatureMissingError extends Error {
  constructor() {
    super(signatureService.missingMessage());
    this.name = "SignatureMissingError";
  }
}

/** Contexto completo necessário para renderizar uma carteirinha. */
export interface CardRenderContext {
  member: Member;
  associationName: string;
  associationAcronym: string;
  associationAddress: string;
  associationPhone: string;
  logoDataUrl: string;
  signatureDataUrl: string;
  presidentName: string;
  presidentTitle: string;
  cardSettings: import("@amococ/shared").CardSettings;
}

function assertPermission(user: PublicUser, permission: Parameters<typeof authorizationService.hasPermission>[1]): void {
  if (!authorizationService.hasPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Fluxo de geração de carteirinha:
 * validar → matrícula → código → foto → assinatura oficial → render → PNG.
 */
export const cardGenerationService = {
  /** Lista carteirinhas emitidas. */
  async getIssuedCards(): Promise<MembershipCardRecord[]> {
    return cardsRepository.getAll();
  },

  async getByMemberId(memberId: string): Promise<MembershipCardRecord | undefined> {
    return cardsRepository.getByMemberId(memberId);
  },

  /**
   * Monta o contexto de renderização SEM checagem de permissão
   * (usado apenas para exibir/visualizar carteirinha já existente).
   */
  async buildContext(memberId: string): Promise<CardRenderContext> {
    const member = await membersRepository.getById(memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");

    const signature = await signatureService.get();
    if (!signature.imageDataUrl) throw new SignatureMissingError();

    const settings = await settingsService.get();
    const logo =
      settings.association.customLogoDataUrl ?? "/assets/images/logo-amococ.png";

    return {
      member,
      associationName: settings.association.name,
      associationAcronym: settings.association.acronym || "AMOCOC",
      associationAddress: settings.association.address,
      associationPhone: settings.association.phone,
      logoDataUrl: logo,
      // Recorta o branco/transparência da volta para a assinatura colar na linha.
      signatureDataUrl: await imageService.trimSignature(signature.imageDataUrl),
      presidentName: signature.presidentName,
      presidentTitle: signature.presidentTitle || "Presidente da Diretoria",
      cardSettings: settings.card,
    };
  },

  /**
   * Valida pré-condições e monta o contexto de renderização.
   * Lança SignatureMissingError quando a assinatura oficial não existe.
   */
  async prepare(actor: PublicUser, memberId: string): Promise<CardRenderContext> {
    assertPermission(actor, "cards.generate");
    return this.buildContext(memberId);
  },

  /** Persiste o registro da carteirinha emitida + PNG gerado. */
  async saveGeneratedCard(
    actor: PublicUser,
    context: CardRenderContext,
    pngDataUrl: string
  ): Promise<MembershipCardRecord> {
    assertPermission(actor, "cards.generate");
    const record: MembershipCardRecord = {
      id: createId(),
      memberId: context.member.id,
      cardCode: context.member.cardCode,
      membershipNumber: context.member.membershipNumber,
      memberName: context.member.fullName,
      generatedAt: new Date().toISOString(),
      generatedByUserId: actor.id,
      generatedByName: actor.name,
      pngDataUrl,
      fileSizeBytes: Math.round((pngDataUrl.length * 3) / 4),
    };
    const saved = await cardsRepository.create(record);
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "CARD_GENERATED",
      entity: "card",
      entityId: saved.id,
      details: `Carteirinha ${saved.cardCode} gerada para "${saved.memberName}" (matrícula ${saved.membershipNumber})`,
    });
    return saved;
  },

  /** Baixa o PNG da carteirinha (usa o arquivo já gerado quando disponível). */
  async downloadCard(
    actor: PublicUser,
    record: MembershipCardRecord
  ): Promise<void> {
    assertPermission(actor, "cards.download");
    if (!record.pngDataUrl) throw new Error("CARD_PNG_MISSING");
    const fileName = membershipCardCodeService.buildFileName(
      record.cardCode,
      record.memberName
    );
    imageService.downloadDataUrl(record.pngDataUrl, fileName);
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "CARD_DOWNLOADED",
      entity: "card",
      entityId: record.id,
      details: `Arquivo ${fileName} baixado`,
    });
  },
};

/** Exporta o nó DOM da carteirinha como PNG em alta resolução. */
export const membershipCardRenderer = {
  /** Aguarda todas as imagens do cartão carregarem antes da exportação. */
  async waitForImages(node: HTMLElement): Promise<void> {
    const images = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      images.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
              setTimeout(resolve, 4000);
            })
      )
    );
    // pequena pausa para decodificação
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  },

  async toPng(node: HTMLElement, pixelRatio = 3): Promise<string> {
    await this.waitForImages(node);
    const { toPng } = await import("html-to-image");
    return toPng(node, {
      pixelRatio,
      cacheBust: true,
      backgroundColor: undefined,
      style: {
        margin: "0",
        transform: "none",
      },
    });
  },

  async download(
    node: HTMLElement,
    record: Pick<MembershipCardRecord, "cardCode" | "memberName">,
    pixelRatio = 3
  ): Promise<string> {
    const dataUrl = await this.toPng(node, pixelRatio);
    const fileName = membershipCardCodeService.buildFileName(
      record.cardCode,
      record.memberName
    );
    imageService.downloadDataUrl(dataUrl, fileName);
    return dataUrl;
  },
};
