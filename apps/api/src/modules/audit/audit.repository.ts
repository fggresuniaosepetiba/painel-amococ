import type { AuditAction, AuditLog } from "@amococ/shared";
import type { AuditLog as PrismaAudit } from "@prisma/client";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";

function toDomain(row: PrismaAudit): AuditLog {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    userName: row.userName,
    action: row.action as AuditAction,
    entity: row.entity,
    entityId: row.entityId,
    details: row.details,
  };
}

const DEFAULT_LIMIT = 5000;

// Implementação Prisma do contrato AuditRepository — ordem decrescente,
// limite de 5000 como no frontend.
export const auditRepository = {
  getAll(db: Db, limit = DEFAULT_LIMIT): Promise<AuditLog[]> {
    return db.auditLog
      .findMany({ orderBy: { createdAt: "desc" }, take: limit })
      .then((rows) => rows.map(toDomain));
  },

  async create(
    db: Db,
    entry: Omit<AuditLog, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<AuditLog> {
    const row = await db.auditLog.create({
      data: {
        id: entry.id ?? createId(),
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details,
        createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
      },
    });
    return toDomain(row);
  },

  async createMany(
    db: Db,
    entries: Omit<AuditLog, "id" | "createdAt">[],
  ): Promise<void> {
    if (entries.length === 0) return;
    await db.auditLog.createMany({
      data: entries.map((entry) => ({
        id: createId(),
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details,
      })),
    });
  },

  filterByAction(
    db: Db,
    action: AuditAction,
    limit = DEFAULT_LIMIT,
  ): Promise<AuditLog[]> {
    return db.auditLog
      .findMany({
        where: { action },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
      .then((rows) => rows.map(toDomain));
  },
};
