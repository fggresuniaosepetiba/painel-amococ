import { db } from "@/db/database";
import type { AuditAction, AuditLog } from "@/types";
import type { AuditRepository } from "../types";

export class IndexedDbAuditRepository implements AuditRepository {
  async getAll(): Promise<AuditLog[]> {
    const all = await db.audit.orderBy("createdAt").reverse().toArray();
    return all.slice(0, 5000);
  }

  async create(entry: AuditLog): Promise<void> {
    await db.audit.add(entry);
  }

  async createMany(entries: AuditLog[]): Promise<void> {
    await db.audit.bulkAdd(entries);
  }

  async filterByAction(action: AuditAction): Promise<AuditLog[]> {
    return db.audit
      .where("action")
      .equals(action)
      .reverse()
      .sortBy("createdAt");
  }
}
