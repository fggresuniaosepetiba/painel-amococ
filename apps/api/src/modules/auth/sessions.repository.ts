import type { Session } from "@prisma/client";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";

// Persistência das sessões (refresh opaco). No banco vive só o SHA-256 do
// refresh (`refreshHash` único) — o token puro trafega apenas na criação.

export interface SessionRecord {
  id: string;
  userId: string;
  refreshHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function toRecord(row: Session): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    refreshHash: row.refreshHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

export const sessionsRepository = {
  async create(
    db: Db,
    input: { userId: string; refreshHash: string; expiresAt: Date },
  ): Promise<SessionRecord> {
    const row = await db.session.create({
      data: { id: createId(), ...input },
    });
    return toRecord(row);
  },

  async findByRefreshHash(
    db: Db,
    refreshHash: string,
  ): Promise<SessionRecord | undefined> {
    const row = await db.session.findUnique({ where: { refreshHash } });
    return row ? toRecord(row) : undefined;
  },

  /** Revoga uma sessão (rotação do refresh ou logout). Idempotente. */
  async revoke(db: Db, id: string): Promise<void> {
    await db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  /** Proteção anti-roubo: reuso de refresh revoga TODAS as sessões do usuário. */
  async revokeAllOfUser(db: Db, userId: string): Promise<number> {
    const result = await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  },

  async deleteExpired(db: Db, now: Date = new Date()): Promise<number> {
    const result = await db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  },
};
