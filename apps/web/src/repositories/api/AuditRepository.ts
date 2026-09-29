import { api } from "@/lib/apiClient";
import type { AuditAction, AuditLog } from "@amococ/shared";
import type { AuditRepository } from "../types";

const PAGE_SIZE = 5000;

export class ApiAuditRepository implements AuditRepository {
  async getAll(): Promise<AuditLog[]> {
    const logs = await api<AuditLog[]>(`/api/audit?limit=${PAGE_SIZE}`);
    return logs.slice(0, PAGE_SIZE);
  }

  /** Fire-and-forget como antes: o service engole erros (nunca quebra o fluxo). */
  async create(entry: AuditLog): Promise<void> {
    await api("/api/audit", {
      method: "POST",
      body: {
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details,
      },
    });
  }

  async createMany(entries: AuditLog[]): Promise<void> {
    for (const entry of entries) {
      await this.create(entry);
    }
  }

  async filterByAction(action: AuditAction): Promise<AuditLog[]> {
    return api<AuditLog[]>(
      `/api/audit?action=${encodeURIComponent(action)}&limit=${PAGE_SIZE}`
    );
  }
}
