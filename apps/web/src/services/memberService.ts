import { cardsRepository, membersRepository } from "@/repositories";
import type { Member, MemberStatus, PublicUser } from "@amococ/shared";
import { createId } from "@/utils/id";
import { auditService } from "./auditService";
import { authorizationService } from "./authorizationService";
import { membershipCardCodeService } from "./membershipCardCodeService";
import { membershipNumberService } from "./membershipNumberService";
import { usedIdentifiersService } from "./usedIdentifiersService";

export type MemberDraft = Omit<
  Member,
  | "id"
  | "membershipNumber"
  | "cardCode"
  | "status"
  | "inactivatedAt"
  | "createdAt"
  | "updatedAt"
> & {
  membershipNumber?: string;
  cardCode?: string;
};

function assertPermission(user: PublicUser, permission: Parameters<typeof authorizationService.hasPermission>[1]): void {
  if (!authorizationService.hasPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Serviço de associados: criação (com matrícula e código imutáveis),
 * edição (nunca altera matrícula/código), inativação/reativação (nunca
 * apaga) e exclusão definitiva.
 *
 * FLUXO DE STATUS:
 *   ATIVO   → visualizar, editar, gerar/baixar carteirinha, INATIVAR
 *             (nunca excluir)
 *   INATIVO → visualizar, REATIVAR, EXCLUIR (somente inativos podem ser
 *             excluídos — regra validada aqui, no service, independentemente
 *             da interface e acima da permissão do usuário)
 *
 * A exclusão é definitiva, mas matrícula e código permanecem reservados
 * para sempre em `usedIdentifiers` — jamais serão reutilizados.
 */
export const memberService = {
  async getAll(): Promise<Member[]> {
    return membersRepository.getAll();
  },

  async getById(id: string): Promise<Member | undefined> {
    return membersRepository.getById(id);
  },

  /** Cria associado. Matrícula e código são gerados aqui — nunca pelo formulário. */
  async create(actor: PublicUser, draft: MemberDraft): Promise<Member> {
    assertPermission(actor, "members.create");

    const membershipNumber =
      draft.membershipNumber && membershipNumberService.isValid(draft.membershipNumber)
        ? draft.membershipNumber
        : await membershipNumberService.previewNext();

    // REGRA CRÍTICA: identificador já utilizado nunca é reutilizado —
    // cobre tanto associados existentes quanto associados excluídos
    // definitivamente (reserva permanente).
    if (await membersRepository.isMembershipNumberTaken(membershipNumber)) {
      throw new Error("IDENTIFIER_ALREADY_USED");
    }

    let cardCode: string;
    if (draft.cardCode && membershipCardCodeService.isValid(draft.cardCode)) {
      const taken = await membersRepository.isCardCodeTaken(draft.cardCode);
      cardCode = taken
        ? await membershipCardCodeService.generateUnique(membershipNumber)
        : draft.cardCode;
    } else {
      cardCode = await membershipCardCodeService.generateUnique(membershipNumber);
    }

    const now = new Date().toISOString();
    const member: Member = {
      ...draft,
      id: createId(),
      membershipNumber,
      cardCode,
      status: "ATIVO",
      inactivatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await membersRepository.create(member);
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "MEMBER_CREATED",
      entity: "member",
      entityId: created.id,
      details: `Associado "${created.fullName}" criado — matrícula ${created.membershipNumber}, código ${created.cardCode}`,
    });
    return created;
  },

  /**
   * Edita dados do associado.
   * Matrícula e código da carteirinha NUNCA são alterados (imutáveis).
   */
  async update(
    actor: PublicUser,
    id: string,
    draft: MemberDraft
  ): Promise<Member> {
    assertPermission(actor, "members.edit");
    const existing = await membersRepository.getById(id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");

    const patch: Partial<Member> = {
      fullName: draft.fullName,
      cpf: draft.cpf,
      birthDate: draft.birthDate,
      phone: draft.phone,
      whatsapp: draft.whatsapp,
      cep: draft.cep,
      address: draft.address,
      addressNumber: draft.addressNumber,
      complement: draft.complement,
      district: draft.district,
      city: draft.city,
      state: draft.state,
      photoDataUrl: draft.photoDataUrl,
      notes: draft.notes,
      updatedAt: new Date().toISOString(),
      // membershipNumber e cardCode permanecem intactos.
    };

    const updated = await membersRepository.update(id, patch);
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "MEMBER_UPDATED",
      entity: "member",
      entityId: id,
      details: `Dados de "${updated.fullName}" atualizados (matrícula ${updated.membershipNumber} preservada)`,
    });
    return updated;
  },

  /** Inativa sem apagar: preserva ID, matrícula, código e histórico. */
  async inactivate(actor: PublicUser, id: string): Promise<Member> {
    assertPermission(actor, "members.inactivate");
    const existing = await membersRepository.getById(id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");
    const now = new Date().toISOString();
    const updated = await membersRepository.update(id, {
      status: "INATIVO" satisfies MemberStatus,
      inactivatedAt: now,
      updatedAt: now,
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "MEMBER_INACTIVATED",
      entity: "member",
      entityId: id,
      details: `"${updated.fullName}" inativado — matrícula ${updated.membershipNumber} e código ${updated.cardCode} preservados`,
    });
    return updated;
  },

  /**
   * Reativa preservando integralmente a identidade: mesmo ID, mesma
   * matrícula, mesmo código da carteirinha e todo o histórico.
   * Nenhuma carteirinha nova é gerada — a identificação permanece a mesma.
   */
  async reactivate(actor: PublicUser, id: string): Promise<Member> {
    assertPermission(actor, "members.reactivate");
    const existing = await membersRepository.getById(id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");
    const updated = await membersRepository.update(id, {
      status: "ATIVO",
      inactivatedAt: null,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "MEMBER_REACTIVATED",
      entity: "member",
      entityId: id,
      details: `"${updated.fullName}" reativado — matrícula ${updated.membershipNumber} e código ${updated.cardCode} preservados`,
    });
    return updated;
  },

  /**
   * EXCLUSÃO DEFINITIVA — somente de associados INATIVOS.
   *
   * A regra de status é validada AQUI no service (camada de negócio) e é
   * superior à permissão: mesmo um usuário com `members.delete` não consegue
   * excluir um associado ativo. A exclusão remove o cadastro e as
   * carteirinhas emitidas, mas matrícula e código permanecem registrados na
   * reserva permanente (`usedIdentifiers`) — nunca serão reutilizados — e a
   * auditoria guarda todos os identificadores históricos.
   */
  async delete(actor: PublicUser, id: string): Promise<void> {
    const existing = await membersRepository.getById(id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");

    // 1) Regra de status (superior à permissão):
    if (existing.status === "ATIVO") {
      throw new Error(
        "Associados ativos não podem ser excluídos. Inative o associado primeiro."
      );
    }
    // 2) Permissão:
    assertPermission(actor, "members.delete");

    // 3) Garante a reserva dos identificadores ANTES de apagar qualquer coisa
    //    (idempotente — se já estiverem registrados, nada muda):
    await usedIdentifiersService.register(existing);

    // 4) Remove as carteirinhas do titular (o histórico permanece na
    //    auditoria CARD_GENERATED e nos identificadores reservados):
    await cardsRepository.deleteByMemberId(id);

    // 5) Remove o cadastro definitivamente:
    await membersRepository.delete(id);

    // 6) Auditoria completa (nunca registra senha):
    await auditService.log({
      userId: actor.id,
      userName: actor.name,
      action: "MEMBER_DELETED",
      entity: "member",
      entityId: id,
      details: `Associado "${existing.fullName}" excluído definitivamente — ID ${id}, matrícula ${existing.membershipNumber} e código ${existing.cardCode} permanecem reservados e nunca serão reutilizados`,
    });
  },
};
