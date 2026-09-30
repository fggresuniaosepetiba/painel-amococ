import type { NextFunction, Request, Response } from "express";
import type { Permission } from "@amococ/shared";
import { ApiError } from "../shared/api-error.js";
import type { Actor } from "../shared/actor.js";
import { ALL_PERMISSIONS } from "../domain/permissions.js";
import { verifyAccessToken, type TokenUser } from "../modules/auth/tokens.js";

// Autorização server-side (Fase 5, §6): espelho exato do
// `authorizationService` do frontend — SUPERADMIN tem bypass total.

export interface AuthenticatedRequest extends Request {
  user: TokenUser;
}

/** Valida o JWT do header `Authorization: Bearer`. Sem token → 401. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") && header.length > 7
      ? header.slice(7)
      : undefined;
  if (!token) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Autenticação necessária. Entre novamente.",
    );
  }
  (req as AuthenticatedRequest).user = verifyAccessToken(token);
  next();
}

/** Ator da auditoria a partir do token (substitui o `actor` do corpo, ADR-010). */
export function reqUser(req: Request): Actor {
  const user = (req as AuthenticatedRequest).user;
  return { id: user.id, name: user.name };
}

/**
 * Exige UMA das permissões (semântica OR = `hasAnyPermission` do frontend).
 * SUPERADMIN passa direto (bypass total §6.1). Exige `requireAuth` antes.
 */
export function requirePermission(...names: Permission[]) {
  for (const name of names) {
    if (!ALL_PERMISSIONS.includes(name)) {
      throw new Error(`requirePermission: permissão desconhecida "${name}"`);
    }
  }
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Autenticação necessária. Entre novamente.",
      );
    }
    if (user.role === "SUPERADMIN") {
      next();
      return;
    }
    if (names.some((name) => user.permissions.includes(name))) {
      next();
      return;
    }
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Você não possui permissão para esta ação.",
    );
  };
}

/** Só SUPERADMIN (espelha o gate da tela "Limpar base de dados"). */
export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Autenticação necessária. Entre novamente.",
    );
  }
  if (user.role !== "SUPERADMIN") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Você não possui permissão para esta ação.",
    );
  }
  next();
}
