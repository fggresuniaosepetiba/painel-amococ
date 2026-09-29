import { api } from "@/lib/apiClient";
import {
  auditRepository,
  cardsRepository,
  membersRepository,
  settingsRepository,
  usedIdentifiersRepository,
  usersRepository,
} from "@/repositories";
import type {
  AppSettings,
  AuditLog,
  Member,
  MembershipCardRecord,
  UsedIdentifier,
  User,
} from "@amococ/shared";

/**
 * Backup JSON (versão 1) da base local — formato aceito por
 * `POST /api/system/import` (Fase 3: migração IndexedDB → PostgreSQL).
 */
export interface BackupV1 {
  version: 1;
  exportedAt: string;
  users: User[];
  members: Member[];
  cards: MembershipCardRecord[];
  settings: AppSettings;
  audit: AuditLog[];
  usedIdentifiers: UsedIdentifier[];
}

export interface BackupCounts {
  users: number;
  members: number;
  cards: number;
  audit: number;
  usedIdentifiers: number;
}

/**
 * Manutenção da base via API (Fase 4: sem IndexedDB no cliente).
 */
export const systemService = {
  /**
   * Limpa TODA a base no servidor e restaura o estado de PRIMEIRA
   * UTILIZAÇÃO (SuperAdmin amococ/123 + padrões; sem demo — "LIMPAR"
   * zera de verdade). O servidor registra o SYSTEM_FACTORY_RESET.
   * O chamador deve encerrar a sessão em seguida, pois o usuário
   * logado deixa de existir.
   */
  async factoryReset(): Promise<void> {
    await api("/api/system/factory-reset", { method: "POST" });
  },

  /**
   * Garante a base mínima no servidor (idempotente — só semeia vazio).
   * Substitui o `seedIfEmpty` local no boot do app.
   */
  async seedIfEmpty(options: { demo?: boolean } = {}): Promise<void> {
    await api("/api/system/seed", {
      method: "POST",
      body: { demo: options.demo ?? false },
    });
  },

  /**
   * Exporta a base local em JSON (BackupV1) para migração ao PostgreSQL
   * (`POST /api/system/import`). Não altera nada na base — só lê e baixa o arquivo.
   */
  async exportBackup(): Promise<BackupCounts> {
    const [users, members, cards, settings, audit, usedIdentifiers] =
      await Promise.all([
        usersRepository.getAll(),
        membersRepository.getAll(),
        cardsRepository.getAll(),
        settingsRepository.get(),
        auditRepository.getAll(),
        usedIdentifiersRepository.getAll(),
      ]);
    const backup: BackupV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users,
      members,
      cards,
      settings,
      audit,
      usedIdentifiers,
    };
    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `amococ-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return {
      users: users.length,
      members: members.length,
      cards: cards.length,
      audit: audit.length,
      usedIdentifiers: usedIdentifiers.length,
    };
  },
};
