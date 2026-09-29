import type { AppSettings } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Actor } from "../../shared/actor.js";
import { SYSTEM_ACTOR } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { settingsRepository } from "./settings.repository.js";

// Serviço de configurações — espelha settingsService + signatureService:
// atualizações por bloco (association/card/security) e assinatura oficial
// (updatedAt só quando há imagem). Alterações → SETTINGS_UPDATED;
// troca de assinatura → SIGNATURE_UPDATED.

function auditAs(who: Actor) {
  return {
    userId: who.id === SYSTEM_ACTOR.id ? null : who.id,
    userName: who.name,
  };
}

export const settingsService = {
  get(db: Db = prisma): Promise<AppSettings> {
    return settingsRepository.get(db);
  },

  async save(
    settings: AppSettings,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<AppSettings> {
    const who = actor ?? SYSTEM_ACTOR;
    const saved = await settingsRepository.save(db, settings);
    await logAudit(db, {
      ...auditAs(who),
      action: "SETTINGS_UPDATED",
      entity: "settings",
      entityId: "general",
      details: "Configurações do sistema atualizadas",
    });
    return saved;
  },

  async updateAssociation(
    patch: Partial<AppSettings["association"]>,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<AppSettings> {
    const who = actor ?? SYSTEM_ACTOR;
    const current = await settingsRepository.get(db);
    const saved = await settingsRepository.save(db, {
      ...current,
      association: { ...current.association, ...patch },
    });
    await logAudit(db, {
      ...auditAs(who),
      action: "SETTINGS_UPDATED",
      entity: "settings",
      entityId: "general",
      details: "Dados da associação atualizados",
    });
    return saved;
  },

  async updateCard(
    patch: Partial<AppSettings["card"]>,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<AppSettings> {
    const who = actor ?? SYSTEM_ACTOR;
    const current = await settingsRepository.get(db);
    const saved = await settingsRepository.save(db, {
      ...current,
      card: { ...current.card, ...patch },
    });
    await logAudit(db, {
      ...auditAs(who),
      action: "SETTINGS_UPDATED",
      entity: "settings",
      entityId: "general",
      details: "Configurações da carteirinha atualizadas",
    });
    return saved;
  },

  async updateSecurity(
    patch: Partial<AppSettings["security"]>,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<AppSettings> {
    const who = actor ?? SYSTEM_ACTOR;
    const current = await settingsRepository.get(db);
    const saved = await settingsRepository.save(db, {
      ...current,
      security: { ...current.security, ...patch },
    });
    await logAudit(db, {
      ...auditAs(who),
      action: "SETTINGS_UPDATED",
      entity: "settings",
      entityId: "general",
      details: "Configurações de segurança atualizadas",
    });
    return saved;
  },

  async saveSignature(
    patch: Partial<AppSettings["signature"]>,
    actor?: Actor | null,
    db: Db = prisma,
  ): Promise<AppSettings> {
    const who = actor ?? SYSTEM_ACTOR;
    const current = await settingsRepository.get(db);
    const imageDataUrl =
      patch.imageDataUrl !== undefined
        ? patch.imageDataUrl
        : current.signature.imageDataUrl;
    const saved = await settingsRepository.save(db, {
      ...current,
      signature: {
        ...current.signature,
        ...patch,
        imageDataUrl,
        updatedAt: imageDataUrl ? new Date().toISOString() : null,
      },
    });
    await logAudit(db, {
      ...auditAs(who),
      action: "SIGNATURE_UPDATED",
      entity: "settings",
      entityId: "general",
      details: `Assinatura oficial atualizada — presidente: ${saved.signature.presidentName || "(não informado)"}`,
    });
    return saved;
  },
};
