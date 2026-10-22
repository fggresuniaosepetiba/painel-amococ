import type { ResidenceDeclaration } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Actor } from "../../shared/actor.js";
import { SYSTEM_ACTOR } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";
import { ApiError } from "../../shared/api-error.js";
import type { DeclarationCreateInput } from "../../shared/validation.js";
import { declarationsRepository } from "./declarations.repository.js";
import { settingsRepository } from "../settings/settings.repository.js";

// Declarações de residência — regras espelhadas das carteirinhas/associados:
// assinatura oficial OBRIGATÓRIA (mesmo motivo §14), auditoria em cada ação,
// exclusão definitiva somente de registros INATIVOS.

export const DECLARATION_SIGNATURE_REQUIRED_TITLE = "Assinatura oficial necessária";
export const DECLARATION_SIGNATURE_REQUIRED_BODY =
  "Não é possível emitir a declaração porque a assinatura oficial do Presidente ainda não foi cadastrada.";

export const declarationsService = {
  list(db: Db = prisma): Promise<ResidenceDeclaration[]> {
    return declarationsRepository.getAll(db);
  },

  getById(
    id: string,
    db: Db = prisma,
  ): Promise<ResidenceDeclaration | undefined> {
    return declarationsRepository.getById(db, id);
  },

  /**
   * Emite a declaração (salva na lista). Os dados vêm do formulário manual —
   * nada é puxado de associados. A assinatura oficial é obrigatória, igual à
   * carteirinha: sem ela o documento sairia sem o responsável.
   */
  async create(
    input: DeclarationCreateInput,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<ResidenceDeclaration> {
    const who = actor ?? SYSTEM_ACTOR;

    const settings = await settingsRepository.get(db);
    if (!settings.signature.imageDataUrl) {
      throw new ApiError(
        422,
        "SIGNATURE_MISSING",
        DECLARATION_SIGNATURE_REQUIRED_BODY,
        DECLARATION_SIGNATURE_REQUIRED_TITLE,
      );
    }

    const saved = await declarationsRepository.create(db, {
      id: createId(),
      residentName: input.residentName,
      birthDate: input.birthDate,
      cpf: input.cpf.trim(),
      address: input.address,
      residenceYears: input.residenceYears,
      residenceMonths: input.residenceMonths,
      issuedAt: new Date().toISOString(),
      issuedByUserId: who.id === SYSTEM_ACTOR.id ? "system" : who.id,
      issuedByName: who.name,
      status: "ATIVO",
      inactivatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "DECLARATION_CREATED",
      entity: "declaration",
      entityId: saved.id,
      details: `Declaração de residência emitida para "${saved.residentName}" (${saved.residenceYears} ano(s) e ${saved.residenceMonths} mês(es) de residência)`,
    });
    return saved;
  },

  /** Registra a impressão da declaração (reimpressão também conta). */
  async registerPrint(
    id: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<void> {
    const who = actor ?? SYSTEM_ACTOR;
    const record = await declarationsRepository.getById(db, id);
    if (!record) throw new Error("DECLARATION_NOT_FOUND");
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "DECLARATION_PRINTED",
      entity: "declaration",
      entityId: record.id,
      details: `Declaração de residência de "${record.residentName}" impressa`,
    });
  },

  async inactivate(
    id: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<ResidenceDeclaration> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await declarationsRepository.getById(db, id);
    if (!existing) throw new Error("DECLARATION_NOT_FOUND");
    const updated = await declarationsRepository.updateStatus(
      db,
      id,
      "INATIVO",
      new Date().toISOString(),
    );
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "DECLARATION_INACTIVATED",
      entity: "declaration",
      entityId: id,
      details: `Declaração de residência de "${updated.residentName}" inativada`,
    });
    return updated;
  },

  async reactivate(
    id: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<ResidenceDeclaration> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await declarationsRepository.getById(db, id);
    if (!existing) throw new Error("DECLARATION_NOT_FOUND");
    const updated = await declarationsRepository.updateStatus(
      db,
      id,
      "ATIVO",
      null,
    );
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "DECLARATION_REACTIVATED",
      entity: "declaration",
      entityId: id,
      details: `Declaração de residência de "${updated.residentName}" reativada`,
    });
    return updated;
  },

  /**
   * EXCLUSÃO DEFINITIVA — somente INATIVAS (mesmo processo do associado:
   * inativar primeiro, depois excluir).
   */
  async delete(
    id: string,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<void> {
    const who = actor ?? SYSTEM_ACTOR;
    const existing = await declarationsRepository.getById(db, id);
    if (!existing) throw new Error("DECLARATION_NOT_FOUND");

    if (existing.status === "ATIVO") {
      throw new ApiError(
        422,
        "ACTIVE_DECLARATION_DELETE",
        "Declarações ativas não podem ser excluídas. Inative a declaração primeiro.",
      );
    }

    await declarationsRepository.remove(db, id);
    await logAudit(db, {
      userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
      userName: who.name,
      action: "DECLARATION_DELETED",
      entity: "declaration",
      entityId: id,
      details: `Declaração de residência de "${existing.residentName}" excluída definitivamente`,
    });
  },
};
