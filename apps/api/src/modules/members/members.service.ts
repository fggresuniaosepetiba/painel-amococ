import type { Member } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Actor } from "../../shared/actor.js";
import { SYSTEM_ACTOR } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";
import { ApiError } from "../../shared/api-error.js";
import type { MemberDraftInput } from "../../shared/validation.js";
import {
  generateUniqueCardCode,
  isValidCardCode,
  isValidMembershipNumber,
  nextMembershipNumber,
} from "../../domain/identifiers.js";
import { membersRepository } from "./members.repository.js";
import { cardsRepository } from "../cards/cards.repository.js";
import { usedIdentifiersRepository } from "../used-identifiers/used-identifiers.repository.js";

// Serviço de associados — regras copiadas do frontend (memberService.ts):
// matrícula/código gerados no SERVIDOR, imutáveis, nunca reutilizados;
// só INATIVOS podem ser excluídos (regra acima da permissão — permissões
// entram na Fase 5); auditoria com os textos exatos do frontend.

export interface MemberCreateInput extends MemberDraftInput {
  actor?: Actor | null;
}

export const membersService = {
  list(db: Db = prisma): Promise<Member[]> {
    return membersRepository.getAll(db);
  },

  getById(id: string, db: Db = prisma): Promise<Member | undefined> {
    return membersRepository.getById(db, id);
  },

  async previewNext(db: Db = prisma): Promise<string> {
    const [memberMax, usedValues] = await Promise.all([
      membersRepository.memberMax(db),
      membersRepository.usedMembershipValues(db),
    ]);
    return nextMembershipNumber(memberMax, usedValues);
  },

  async create(input: MemberCreateInput, db: Db = prisma): Promise<Member> {
    const actor = input.actor ?? SYSTEM_ACTOR;

    const membershipNumber =
      input.membershipNumber && isValidMembershipNumber(input.membershipNumber)
        ? input.membershipNumber
        : await this.previewNext(db);

    if (await membersRepository.isMembershipNumberTaken(db, membershipNumber)) {
      throw new Error("IDENTIFIER_ALREADY_USED");
    }

    let cardCode: string;
    if (input.cardCode && isValidCardCode(input.cardCode)) {
      const taken = await membersRepository.isCardCodeTaken(db, input.cardCode);
      cardCode = taken
        ? await generateUniqueCardCode(membershipNumber, (code) =>
            membersRepository.isCardCodeTaken(db, code),
          )
        : input.cardCode;
    } else {
      cardCode = await generateUniqueCardCode(membershipNumber, (code) =>
        membersRepository.isCardCodeTaken(db, code),
      );
    }

    const now = new Date().toISOString();
    const member: Member = {
      fullName: input.fullName,
      cpf: input.cpf,
      birthDate: input.birthDate,
      phone: input.phone,
      whatsapp: input.whatsapp,
      cep: input.cep,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      district: input.district,
      city: input.city,
      state: input.state,
      photoDataUrl: input.photoDataUrl,
      notes: input.notes,
      id: createId(),
      membershipNumber,
      cardCode,
      status: "ATIVO",
      inactivatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await membersRepository.create(db, member);
    await logAudit(db, {
      userId: actor.id === SYSTEM_ACTOR.id ? null : actor.id,
      userName: actor.name,
      action: "MEMBER_CREATED",
      entity: "member",
      entityId: created.id,
      details: `Associado "${created.fullName}" criado — matrícula ${created.membershipNumber}, código ${created.cardCode}`,
    });
    return created;
  },

  /** Edição: matrícula e código NUNCA alterados (imutáveis). */
  async update(
    id: string,
    draft: MemberDraftInput,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<Member> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await membersRepository.getById(db, id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");

    const updated = await membersRepository.update(db, id, {
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
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "MEMBER_UPDATED",
      entity: "member",
      entityId: id,
      details: `Dados de "${updated.fullName}" atualizados (matrícula ${updated.membershipNumber} preservada)`,
    });
    return updated;
  },

  async inactivate(id: string, actor?: Actor | null, db: Db = prisma): Promise<Member> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await membersRepository.getById(db, id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");
    const now = new Date().toISOString();
    const updated = await membersRepository.update(db, id, {
      status: "INATIVO",
      inactivatedAt: now,
      updatedAt: now,
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "MEMBER_INACTIVATED",
      entity: "member",
      entityId: id,
      details: `"${updated.fullName}" inativado — matrícula ${updated.membershipNumber} e código ${updated.cardCode} preservados`,
    });
    return updated;
  },

  async reactivate(id: string, actor?: Actor | null, db: Db = prisma): Promise<Member> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await membersRepository.getById(db, id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");
    const updated = await membersRepository.update(db, id, {
      status: "ATIVO",
      inactivatedAt: null,
      updatedAt: new Date().toISOString(),
    });
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "MEMBER_REACTIVATED",
      entity: "member",
      entityId: id,
      details: `"${updated.fullName}" reativado — matrícula ${updated.membershipNumber} e código ${updated.cardCode} preservados`,
    });
    return updated;
  },

  /**
   * EXCLUSÃO DEFINITIVA — somente INATIVOS. Regra de status superior à
   * permissão, com a mensagem exata do frontend (§14).
   */
  async delete(id: string, actor?: Actor | null, db: Db = prisma): Promise<void> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await membersRepository.getById(db, id);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");

    if (existing.status === "ATIVO") {
      throw new ApiError(
        422,
        "ACTIVE_MEMBER_DELETE",
        "Associados ativos não podem ser excluídos. Inative o associado primeiro.",
      );
    }

    await usedIdentifiersRepository.register(db, {
      value: existing.membershipNumber,
      type: "membershipNumber",
      usedAt: new Date().toISOString(),
      memberId: existing.id,
      memberName: existing.fullName,
    });
    await usedIdentifiersRepository.register(db, {
      value: existing.cardCode,
      type: "cardCode",
      usedAt: new Date().toISOString(),
      memberId: existing.id,
      memberName: existing.fullName,
    });

    await cardsRepository.deleteByMemberId(db, id);
    await membersRepository.delete(db, id);

    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "MEMBER_DELETED",
      entity: "member",
      entityId: id,
      details: `Associado "${existing.fullName}" excluído definitivamente — ID ${id}, matrícula ${existing.membershipNumber} e código ${existing.cardCode} permanecem reservados e nunca serão reutilizados`,
    });
  },
};
