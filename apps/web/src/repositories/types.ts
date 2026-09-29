import type {
  AppSettings,
  AuditAction,
  AuditLog,
  MembershipCardRecord,
  Member,
  MemberStatus,
  UsedIdentifier,
  User,
} from "@amococ/shared";

/**
 * Interfaces de repositório.
 * A aplicação depende SOMENTE destas interfaces; a implementação atual é
 * IndexedDB (Dexie) e poderá ser substituída por uma API HTTP (backend)
 * sem alterar services nem componentes.
 */

export interface UsersRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | undefined>;
  getByLogin(login: string): Promise<User | undefined>;
  count(): Promise<number>;
  create(user: User): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User>;
}

export interface MembersRepository {
  getAll(): Promise<Member[]>;
  getById(id: string): Promise<Member | undefined>;
  count(): Promise<number>;
  countByStatus(status: MemberStatus): Promise<number>;
  nextMembershipNumber(): Promise<string>;
  isMembershipNumberTaken(value: string): Promise<boolean>;
  isCardCodeTaken(code: string): Promise<boolean>;
  create(member: Member): Promise<Member>;
  update(id: string, patch: Partial<Member>): Promise<Member>;
  /** Exclusão definitiva (somente de associados INATIVOS — validada no service). */
  delete(id: string): Promise<void>;
}

export interface CardsRepository {
  getAll(): Promise<MembershipCardRecord[]>;
  getById(id: string): Promise<MembershipCardRecord | undefined>;
  getByMemberId(memberId: string): Promise<MembershipCardRecord | undefined>;
  count(): Promise<number>;
  create(record: MembershipCardRecord): Promise<MembershipCardRecord>;
  update(
    id: string,
    patch: Partial<MembershipCardRecord>
  ): Promise<MembershipCardRecord>;
  /** Remove as carteirinhas de um associado excluído definitivamente. */
  deleteByMemberId(memberId: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<AppSettings>;
}

export interface AuditRepository {
  getAll(): Promise<AuditLog[]>;
  create(entry: AuditLog): Promise<void>;
  createMany(entries: AuditLog[]): Promise<void>;
  filterByAction(action: AuditAction): Promise<AuditLog[]>;
}

/**
 * Reserva PERMANENTE de identificadores já emitidos.
 * Estes registros NUNCA são apagados (nem por exclusão de associado nem
 * por operação comum) — garantem que matrículas e códigos usados jamais
 * voltem a ser utilizados.
 */
export interface UsedIdentifiersRepository {
  getAll(): Promise<UsedIdentifier[]>;
  isUsed(value: string): Promise<boolean>;
  /** Idempotente: o primeiro registro de um valor é o histórico definitivo. */
  register(record: UsedIdentifier): Promise<void>;
}

export interface TransactionRunner {
  run<T>(mode: "r" | "rw", tables: string[], fn: () => Promise<T>): Promise<T>;
}
