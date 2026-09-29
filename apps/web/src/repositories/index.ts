/**
 * Composition root dos repositórios (Fase 4: implementações HTTP sobre a API).
 * Nenhum service ou componente precisa mudar — todos dependem só das interfaces.
 */
import { ApiAuditRepository } from "./api/AuditRepository";
import { ApiCardsRepository } from "./api/CardsRepository";
import { ApiMembersRepository } from "./api/MembersRepository";
import { ApiSettingsRepository } from "./api/SettingsRepository";
import { ApiUsedIdentifiersRepository } from "./api/UsedIdentifiersRepository";
import { ApiUsersRepository } from "./api/UsersRepository";
import type {
  AuditRepository,
  CardsRepository,
  MembersRepository,
  SettingsRepository,
  UsedIdentifiersRepository,
  UsersRepository,
} from "./types";

export const usersRepository: UsersRepository = new ApiUsersRepository();
export const membersRepository: MembersRepository =
  new ApiMembersRepository();
export const cardsRepository: CardsRepository = new ApiCardsRepository();
export const settingsRepository: SettingsRepository =
  new ApiSettingsRepository();
export const auditRepository: AuditRepository = new ApiAuditRepository();
export const usedIdentifiersRepository: UsedIdentifiersRepository =
  new ApiUsedIdentifiersRepository();

export { DEFAULT_SETTINGS } from "./api/SettingsRepository";
export type {
  AuditRepository,
  CardsRepository,
  MembersRepository,
  SettingsRepository,
  UsedIdentifiersRepository,
  UsersRepository,
} from "./types";
