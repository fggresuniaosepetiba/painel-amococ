import type { MembershipCardRecord } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Actor } from "../../shared/actor.js";
import { SYSTEM_ACTOR } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";
import { ApiError } from "../../shared/api-error.js";
import { buildCardFileName } from "../../domain/identifiers.js";
import { cardsRepository } from "./cards.repository.js";
import { membersRepository } from "../members/members.repository.js";
import { settingsRepository } from "../settings/settings.repository.js";

// Serviço de carteirinhas — regras copiadas do frontend (cardGenerationService):
// assinatura oficial OBRIGATÓRIA (mensagens exatas §14), registro + CARD_GENERATED,
// download registra CARD_DOWNLOADED e devolve o nome oficial do arquivo.

// Mensagens exatas (§14 de prompts/003-regras-negocio.md).
export const SIGNATURE_REQUIRED_TITLE = "Assinatura oficial necessária";
export const SIGNATURE_REQUIRED_BODY =
  "Não é possível gerar a carteirinha porque a assinatura oficial do Presidente ainda não foi cadastrada.";

export const cardsService = {
  list(db: Db = prisma): Promise<MembershipCardRecord[]> {
    return cardsRepository.getAll(db);
  },

  getById(id: string, db: Db = prisma): Promise<MembershipCardRecord | undefined> {
    return cardsRepository.getById(db, id);
  },

  getByMemberId(
    memberId: string,
    db: Db = prisma,
  ): Promise<MembershipCardRecord | undefined> {
    return cardsRepository.getByMemberId(db, memberId);
  },

  /** Gera (registra) a carteirinha — PNG renderizado no frontend. */
  async generate(
    memberId: string,
    pngDataUrl: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<MembershipCardRecord> {
    const who = actor ?? SYSTEM_ACTOR;
    const member = await membersRepository.getById(db, memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");

    const settings = await settingsRepository.get(db);
    if (!settings.signature.imageDataUrl) {
      throw new ApiError(
        422,
        "SIGNATURE_MISSING",
        SIGNATURE_REQUIRED_BODY,
        SIGNATURE_REQUIRED_TITLE,
      );
    }

    const now = new Date().toISOString();
    const saved = await cardsRepository.create(db, {
      id: createId(),
      memberId: member.id,
      cardCode: member.cardCode,
      membershipNumber: member.membershipNumber,
      memberName: member.fullName,
      generatedAt: now,
      generatedByUserId: who.id === SYSTEM_ACTOR.id ? "system" : who.id,
      generatedByName: who.name,
      pngDataUrl,
      fileSizeBytes: Math.round((pngDataUrl.length * 3) / 4),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "CARD_GENERATED",
      entity: "card",
      entityId: saved.id,
      details: `Carteirinha ${saved.cardCode} gerada para "${saved.memberName}" (matrícula ${saved.membershipNumber})`,
    });
    return saved;
  },

  /** Registra o download e devolve o nome oficial do arquivo. */
  async registerDownload(
    id: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<{ record: MembershipCardRecord; fileName: string }> {
    const who = actor ?? SYSTEM_ACTOR;
    const record = await cardsRepository.getById(db, id);
    if (!record) throw new Error("CARD_NOT_FOUND");
    if (!record.pngDataUrl) throw new Error("CARD_PNG_MISSING");
    const fileName = buildCardFileName(record.cardCode, record.memberName);
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "CARD_DOWNLOADED",
      entity: "card",
      entityId: record.id,
      details: `Arquivo ${fileName} baixado`,
    });
    return { record, fileName };
  },
};
