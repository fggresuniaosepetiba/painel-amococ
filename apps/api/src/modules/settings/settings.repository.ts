import type { AppSettings } from "@amococ/shared";
import type { Prisma } from "@prisma/client";
import type { Db } from "../../shared/db.js";
import { DEFAULT_SETTINGS, mergeWithDefaults } from "../../domain/default-settings.js";

// Implementação Prisma do contrato SettingsRepository — registro único
// ("general"), merge com padrões na leitura, updatedAt automático no save.
export const settingsRepository = {
  async get(db: Db): Promise<AppSettings> {
    const row = await db.setting.findUnique({ where: { id: "general" } });
    if (!row) {
      const initial: AppSettings = {
        ...DEFAULT_SETTINGS,
        updatedAt: new Date().toISOString(),
      };
      await db.setting.create({
        data: {
          id: "general",
          data: initial as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(initial.updatedAt),
        },
      });
      return initial;
    }
    return mergeWithDefaults(row.data as unknown as Partial<AppSettings>);
  },

  async save(db: Db, settings: AppSettings): Promise<AppSettings> {
    const toSave: AppSettings = {
      ...settings,
      id: "general",
      updatedAt: new Date().toISOString(),
    };
    await db.setting.upsert({
      where: { id: "general" },
      update: {
        data: toSave as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(toSave.updatedAt),
      },
      create: {
        id: "general",
        data: toSave as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(toSave.updatedAt),
      },
    });
    return toSave;
  },
};
