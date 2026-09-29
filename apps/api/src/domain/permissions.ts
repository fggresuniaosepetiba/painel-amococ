import type { Permission } from "@amococ/shared";

// Espelho RUNTIME de packages/shared/src/permissions.ts (fonte da verdade).
// Duplicado porque @amococ/shared só expõe tipos em tempo de build para a API;
// qualquer mudança nas 18 permissões deve ser replicada aqui.
export type { Permission };

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "members.view",
  "members.create",
  "members.edit",
  "members.inactivate",
  "members.reactivate",
  "members.delete",
  "cards.view",
  "cards.generate",
  "cards.download",
  "users.view",
  "users.create",
  "users.edit",
  "users.inactivate",
  "users.permissions",
  "settings.view",
  "settings.edit",
  "audit.view",
];

export function isPermission(value: unknown): value is Permission {
  return (
    typeof value === "string" &&
    (ALL_PERMISSIONS as string[]).includes(value)
  );
}
