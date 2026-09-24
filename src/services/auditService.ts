import { auditRepository } from "@/repositories";
import type { AuditAction, AuditLog } from "@/types";
import { createId } from "@/utils/id";

interface AuditInput {
  userId: string | null;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  details: string;
}

/**
 * Serviço central de auditoria.
 * Registra ações relevantes do sistema. NUNCA registra senhas.
 */
export const auditService = {
  async log(input: AuditInput): Promise<void> {
    try {
      const entry: AuditLog = {
        id: createId(),
        createdAt: new Date().toISOString(),
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        details: input.details,
      };
      await auditRepository.create(entry);
    } catch {
      // Auditoria nunca deve quebrar o fluxo principal do usuário.
    }
  },
};
