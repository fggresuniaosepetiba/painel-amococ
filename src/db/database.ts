import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  AuditLog,
  MembershipCardRecord,
  Member,
  UsedIdentifier,
  User,
} from "@/types";

export class AmococDatabase extends Dexie {
  users!: Table<User, string>;
  members!: Table<Member, string>;
  cards!: Table<MembershipCardRecord, string>;
  settings!: Table<AppSettings, string>;
  audit!: Table<AuditLog, string>;
  usedIdentifiers!: Table<UsedIdentifier, string>;

  constructor() {
    super("amococ_db");

    this.version(1).stores({
      users: "id, &login, email, status, createdAt",
      members:
        "id, &membershipNumber, &cardCode, fullName, cpf, status, createdAt",
      cards: "id, &cardCode, memberId, &membershipNumber, generatedAt",
      settings: "id",
      audit: "id, createdAt, userId, action, entity",
    });

    // v2: reserva PERMANENTE de identificadores. Matrículas e códigos já
    // emitidos continuam registrados mesmo após a exclusão definitiva do
    // associado — e por isso nunca são reutilizados.
    this.version(2).stores({
      usedIdentifiers: "&value, type, usedAt",
    });
  }
}

export const db = new AmococDatabase();
