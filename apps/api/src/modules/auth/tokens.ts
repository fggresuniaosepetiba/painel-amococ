import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { ApiError } from "../../shared/api-error.js";
import type { Permission } from "@amococ/shared";

// Tokens e credenciais da Fase 5 (ADR-005):
// - access JWT HS256 de 15 min (espelha o idle LGPD), stateless;
// - refresh opaco (48 bytes aleatórios): no banco vive só o SHA-256;
// - dual-verify de senha: bcrypt, com fallback ao legado SHA-256
//   (`SHA-256 hex de "salt:password"`, formato do utils/password.ts
//   removido na Fase 4) + upgrade transparente para bcrypt.

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 7;

export interface TokenUser {
  id: string;
  name: string;
  role: "SUPERADMIN" | "ADMINISTRADOR" | "COLABORADOR";
  permissions: Permission[];
}

interface AccessClaims {
  sub: string;
  name: string;
  role: TokenUser["role"];
  permissions: Permission[];
}

export function signAccessToken(user: TokenUser): string {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    } satisfies AccessClaims,
    env.jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}

/** Token inválido/expirado → 401 genérico (sem detalhar o motivo). */
export function verifyAccessToken(token: string): TokenUser {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AccessClaims & {
      sub?: unknown;
    };
    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.name !== "string" ||
      (decoded.role !== "SUPERADMIN" &&
        decoded.role !== "ADMINISTRADOR" &&
        decoded.role !== "COLABORADOR") ||
      !Array.isArray(decoded.permissions)
    ) {
      throw new Error("malformed claims");
    }
    return {
      id: decoded.sub,
      name: decoded.name,
      role: decoded.role,
      permissions: decoded.permissions.filter(
        (p): p is Permission => typeof p === "string",
      ),
    };
  } catch {
    throw new ApiError(
      401,
      "INVALID_TOKEN",
      "Sessão inválida. Entre novamente.",
    );
  }
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("hex");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Confere senha no formato legado (SHA-256 hex de `salt:password`).
 * Comparação em tempo constante; qualquer formato inesperado → false.
 */
export function verifyLegacyPassword(
  plain: string,
  salt: string,
  expectedHash: string,
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const actual = createHash("sha256")
    .update(`${salt}:${plain}`, "utf8")
    .digest("hex");
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expectedHash.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
