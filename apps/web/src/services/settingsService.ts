import { settingsRepository } from "@/repositories";
import type { AppSettings } from "@amococ/shared";

/** Serviço de configurações gerais do sistema. */
export const settingsService = {
  async get(): Promise<AppSettings> {
    return settingsRepository.get();
  },

  async updateAssociation(
    patch: Partial<AppSettings["association"]>
  ): Promise<AppSettings> {
    const current = await settingsRepository.get();
    return settingsRepository.save({
      ...current,
      association: { ...current.association, ...patch },
    });
  },

  async updateCard(patch: Partial<AppSettings["card"]>): Promise<AppSettings> {
    const current = await settingsRepository.get();
    return settingsRepository.save({
      ...current,
      card: { ...current.card, ...patch },
    });
  },

  async updateSecurity(
    patch: Partial<AppSettings["security"]>
  ): Promise<AppSettings> {
    const current = await settingsRepository.get();
    return settingsRepository.save({
      ...current,
      security: { ...current.security, ...patch },
    });
  },
};
