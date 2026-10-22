import type { AuditAction } from "@amococ/shared";

// Espelho RUNTIME dos 24 eventos de AuditAction (fonte: packages/shared/src/types.ts).
export const AUDIT_ACTIONS: AuditAction[] = [
  "LOGIN",
  "LOGOUT",
  "MEMBER_CREATED",
  "MEMBER_UPDATED",
  "MEMBER_INACTIVATED",
  "MEMBER_REACTIVATED",
  "MEMBER_DELETED",
  "CARD_GENERATED",
  "CARD_DOWNLOADED",
  "DECLARATION_CREATED",
  "DECLARATION_PRINTED",
  "DECLARATION_INACTIVATED",
  "DECLARATION_REACTIVATED",
  "DECLARATION_DELETED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_INACTIVATED",
  "USER_REACTIVATED",
  "USER_DELETED",
  "PERMISSION_CHANGED",
  "SETTINGS_UPDATED",
  "SIGNATURE_UPDATED",
  "PASSWORD_CHANGED",
  "SYSTEM_FACTORY_RESET",
];

export function isAuditAction(value: unknown): value is AuditAction {
  return (
    typeof value === "string" && (AUDIT_ACTIONS as string[]).includes(value)
  );
}
