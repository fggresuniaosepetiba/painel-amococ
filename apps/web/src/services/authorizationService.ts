import type { Permission } from "@amococ/shared";
import { ALL_PERMISSIONS } from "@amococ/shared";
import type { PublicUser } from "@amococ/shared";

/**
 * Camada centralizada de autorização.
 * Regra única de verificação de permissões usada por rotas, componentes e
 * services. O SuperAdmin nunca é bloqueado pelas permissões comuns.
 */
export const authorizationService = {
  isSuperAdmin(user: Pick<PublicUser, "role"> | null): boolean {
    return user?.role === "SUPERADMIN";
  },

  hasPermission(
    user: Pick<PublicUser, "role" | "permissions"> | null,
    permission: Permission
  ): boolean {
    if (!user) return false;
    if (user.role === "SUPERADMIN") return true;
    return user.permissions.includes(permission);
  },

  hasAnyPermission(
    user: Pick<PublicUser, "role" | "permissions"> | null,
    permissions: Permission[]
  ): boolean {
    return permissions.some((p) => authorizationService.hasPermission(user, p));
  },

  /** Permissões efetivas (para exibição). */
  effectivePermissions(user: Pick<PublicUser, "role" | "permissions">): Permission[] {
    if (user.role === "SUPERADMIN") return ALL_PERMISSIONS;
    return user.permissions;
  },
};

export function hasPermission(
  user: Pick<PublicUser, "role" | "permissions"> | null,
  permission: Permission
): boolean {
  return authorizationService.hasPermission(user, permission);
}
