import { db } from "@/db/database";
import { auditService } from "./auditService";
import { seedIfEmpty } from "./seedService";

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
  async factoryReset(): Promise<void> {
    await db.transaction(
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
};
