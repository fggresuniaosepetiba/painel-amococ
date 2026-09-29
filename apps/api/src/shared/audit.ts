import type { AuditAction } from "@amococ/shared";
import { createId } from "./ids.js";
import type { Db } from "./db.js";

export interface AuditInput {
  userId: string | null;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  details: string;
}

// Auditoria nunca quebra o fluxo principal (mesma regra do frontend).
export async function logAudit(db: Db, input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        id: createId(),
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        details: input.details,
      },
    });
  } catch {
    // intencional: auditoria é acessória
  }
}
