/**
 * Composition root dos repositórios.
 * Para migrar para backend, basta substituir as implementações abaixo
 * por classes `Api*Repository` — nenhum service ou componente precisa mudar.
 */
import { IndexedDbAuditRepository } from "./indexeddb/AuditRepository";
import { IndexedDbCardsRepository } from "./indexeddb/CardsRepository";
import { IndexedDbMembersRepository } from "./indexeddb/MembersRepository";
import { IndexedDbSettingsRepository } from "./indexeddb/SettingsRepository";
import { IndexedDbUsedIdentifiersRepository } from "./indexeddb/UsedIdentifiersRepository";
import { IndexedDbUsersRepository } from "./indexeddb/UsersRepository";
import type {
  AuditRepository,
  CardsRepository,
  MembersRepository,
  SettingsRepository,
  UsedIdentifiersRepository,
  UsersRepository,
} from "./types";

export const usersRepository: UsersRepository = new IndexedDbUsersRepository();
export const membersRepository: MembersRepository =
  new IndexedDbMembersRepository();
export const cardsRepository: CardsRepository = new IndexedDbCardsRepository();
export const settingsRepository: SettingsRepository =
  new IndexedDbSettingsRepository();
export const auditRepository: AuditRepository = new IndexedDbAuditRepository();
export const usedIdentifiersRepository: UsedIdentifiersRepository =
  new IndexedDbUsedIdentifiersRepository();

export { DEFAULT_SETTINGS } from "./indexeddb/SettingsRepository";
export type {
  AuditRepository,
  CardsRepository,
  MembersRepository,
  SettingsRepository,
  UsedIdentifiersRepository,
  UsersRepository,
} from "./types";
