import type { UsedIdentifier } from "@amococ/shared";
import type { UsedIdentifier as PrismaUsed } from "@prisma/client";
import type { Db } from "../../shared/db.js";

function toDomain(row: PrismaUsed): UsedIdentifier {
  return {
    value: row.value,
    type: row.type as UsedIdentifier["type"],
    usedAt: row.usedAt.toISOString(),
    memberId: row.memberId,
    memberName: row.memberName,
  };
}

// Reserva PERMANENTE — nunca apagada por nenhuma operação deste módulo.
export const usedIdentifiersRepository = {
  getAll(db: Db): Promise<UsedIdentifier[]> {
    return db.usedIdentifier
      .findMany({ orderBy: { usedAt: "asc" } })
      .then((rows) => rows.map(toDomain));
  },

  async isUsed(db: Db, value: string): Promise<boolean> {
    const found = await db.usedIdentifier.findUnique({
      where: { value },
      select: { value: true },
    });
    return Boolean(found);
  },

  /** Idempotente: o primeiro registro é a história definitiva. */
  async register(db: Db, record: UsedIdentifier): Promise<void> {
    await db.usedIdentifier.upsert({
      where: { value: record.value },
      update: {},
      create: {
        ...record,
        usedAt: new Date(record.usedAt),
      },
    });
  },
};
