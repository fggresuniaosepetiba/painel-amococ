import { db } from "@/db/database";
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
import { auditService } from "./auditService";
import { seedIfEmpty } from "./seedService";

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
 * Manutenção do banco local (IndexedDB — amococ_db).
 */
export const systemService = {
  /**
   * Limpa TODA a base local e restaura o estado de PRIMEIRA UTILIZAÇÃO —
   * em qualquer ambiente: SuperAdmin amococ/123, configurações padrão e
   * assinatura oficial (produção). Os dados de demonstração de
   * desenvolvimento NÃO são recriados: "LIMPAR" zera de verdade.
   *
   * Apaga: associados, carteirinhas emitidas, usuários, configurações,
   * assinatura oficial, registros de auditoria e identificadores reservados
   * (o seed os recria em seguida). Registra a própria ação na auditoria
   * após o reset. O chamador deve encerrar a sessão em seguida, pois o
   * usuário logado deixa de existir.
   */
  async factoryReset(): Promise<void> {    await db.transaction(
      "rw",
      [
        db.users,
        db.members,
        db.cards,
        db.settings,
        db.audit,
        db.usedIdentifiers,
      ],
      async () => {
        await db.audit.clear();
        await db.cards.clear();
        await db.members.clear();
        await db.settings.clear();
        await db.users.clear();
        await db.usedIdentifiers.clear();
      }
    );
    // Restaura apenas o estado base — a demonstração não volta.
    await seedIfEmpty({ demo: false });
    const admin = await db.users.where("login").equals("amococ").first();
    if (admin) {
      await auditService.log({
        userId: admin.id,
        userName: admin.name,
        action: "SYSTEM_FACTORY_RESET",
        entity: "settings",
        entityId: "system",
        details:
          "Base de dados local limpa e restaurada para o estado inicial (fábrica)",
      });
    }
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
