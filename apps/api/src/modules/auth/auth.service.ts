import type { PublicUser, User } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import { ApiError } from "../../shared/api-error.js";
import type { Actor } from "../../shared/actor.js";
import type { Db } from "../../shared/db.js";
import { passwordHasher } from "../users/password-hasher.js";
import { toPublicUser, usersRepository } from "../users/users.repository.js";
import { settingsService } from "../settings/settings.service.js";
import { sessionsRepository } from "./sessions.repository.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyLegacyPassword,
} from "./tokens.js";

// Autenticação e sessão (Fase 5, ADR-004/005):
// - login com dual-verify (bcrypt + legado SHA-256 com upgrade transparente);
// - falha NUNCA distingue o motivo (mensagem única §14; INATIVO idem);
// - refresh opaco rotativo; reuso revoga todas as sessões (anti-roubo);
// - LOGIN/LOGOUT auditados no servidor (fonte única, ADR-015).

/** Mensagem única de falha de autenticação (§14 — copiar literalmente). */
export const INVALID_CREDENTIALS_MESSAGE =
  "Usuário ou senha incorretos. Verifique os dados e tente novamente.";

function invalidCredentials(): ApiError {
  return new ApiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Segundos até a expiração do access (espelha o idle LGPD de 15 min). */
  expiresIn: number;
}

export interface LoginResult extends AuthTokens {
  user: PublicUser;
}

function toTokenUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  };
}

async function issueSession(
  db: Db,
  user: User,
): Promise<AuthTokens> {
  const { token: refreshToken, hash } = generateRefreshToken();
  await sessionsRepository.create(db, {
    userId: user.id,
    refreshHash: hash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return {
    accessToken: signAccessToken(toTokenUser(user)),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/**
 * Confere a senha e, quando o hash ainda é legado (SHA-256), promove para
 * bcrypt de forma transparente no primeiro login bem-sucedido (ADR-013).
 */
async function verifyAndUpgrade(
  db: Db,
  user: User,
  plain: string,
): Promise<boolean> {
  if (await passwordHasher.verify(plain, user.passwordHash)) return true;
  if (!verifyLegacyPassword(plain, user.salt, user.passwordHash)) return false;
  const { salt, hash } = await passwordHasher.hash(plain);
  await usersRepository.update(db, user.id, { salt, passwordHash: hash });
  return true;
}

export const authService = {
  async login(
    login: string,
    password: string,
    db: Db = prisma,
  ): Promise<LoginResult> {
    const normalized = login.trim().toLowerCase();
    const user = await usersRepository.getByLogin(db, normalized);
    // Mesmo caminho para inexistente, senha errada e INATIVO: sem enumeração.
    if (!user || !(await verifyAndUpgrade(db, user, password))) {
      throw invalidCredentials();
    }
    if (user.status !== "ATIVO") {
      throw invalidCredentials();
    }
    const now = new Date().toISOString();
    await usersRepository.update(db, user.id, { lastLoginAt: now });
    const tokens = await issueSession(db, user);
    await logAudit(db, {
      userId: user.id,
      userName: user.name,
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      details: `Login realizado por ${user.login}`,
    });
    const updated = (await usersRepository.getById(db, user.id)) ?? user;
    return { ...tokens, user: toPublicUser({ ...updated, lastLoginAt: now }) };
  },

  async refresh(
    refreshToken: string,
    db: Db = prisma,
  ): Promise<LoginResult> {
    const session = await sessionsRepository.findByRefreshHash(
      db,
      hashRefreshToken(refreshToken),
    );
    if (!session) {
      // Token desconhecido: 401 seco (não há usuário para revogar).
      throw new ApiError(401, "INVALID_SESSION", "Sessão inválida. Entre novamente.");
    }
    if (session.revokedAt) {
      // Reuso de refresh já rotacionado = possível roubo: derruba tudo.
      await sessionsRepository.revokeAllOfUser(db, session.userId);
      throw new ApiError(401, "SESSION_REUSED", "Sessão inválida. Entre novamente.");
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await sessionsRepository.revoke(db, session.id);
      throw new ApiError(401, "SESSION_EXPIRED", "Sessão inválida. Entre novamente.");
    }
    const user = await usersRepository.getById(db, session.userId);
    if (!user || user.status !== "ATIVO") {
      // Usuário removido ou inativado: encerra todas as sessões.
      await sessionsRepository.revokeAllOfUser(db, session.userId);
      throw new ApiError(401, "INVALID_SESSION", "Sessão inválida. Entre novamente.");
    }
    await sessionsRepository.revoke(db, session.id);
    const tokens = await issueSession(db, user);
    return { ...tokens, user: toPublicUser(user) };
  },

  /** Revoga o refresh e audita LOGOUT. Idempotente (token ausente = no-op). */
  async logout(refreshToken: string | undefined, db: Db = prisma): Promise<void> {
    if (!refreshToken) return;
    const session = await sessionsRepository.findByRefreshHash(
      db,
      hashRefreshToken(refreshToken),
    );
    if (!session || session.revokedAt) return;
    await sessionsRepository.revoke(db, session.id);
    const user = await usersRepository.getById(db, session.userId);
    if (!user) return;
    await logAudit(db, {
      userId: user.id,
      userName: user.name,
      action: "LOGOUT",
      entity: "user",
      entityId: user.id,
      details: `Sessão encerrada por ${user.login}`,
    });
  },

  async me(userId: string, db: Db = prisma): Promise<PublicUser> {
    const user = await usersRepository.getById(db, userId);
    if (!user || user.status !== "ATIVO") {
      throw new ApiError(401, "INVALID_SESSION", "Sessão inválida. Entre novamente.");
    }
    return toPublicUser(user);
  },

  async changePassword(
    actor: Actor,
    currentPassword: string,
    newPassword: string,
    db: Db = prisma,
  ): Promise<void> {
    const user = await usersRepository.getById(db, actor.id);
    if (!user) {
      throw new ApiError(401, "INVALID_SESSION", "Sessão inválida. Entre novamente.");
    }
    if (!(await verifyAndUpgrade(db, user, currentPassword))) {
      // Mensagem exata §14 (copiar literalmente).
      throw new ApiError(401, "INVALID_CURRENT_PASSWORD", "A senha atual está incorreta.");
    }
    const { salt, hash } = await passwordHasher.hash(newPassword);
    await usersRepository.update(db, user.id, {
      salt,
      passwordHash: hash,
      mustChangePassword: false,
    });
    await settingsService.updateSecurity(
      { lastPasswordChangeAt: new Date().toISOString() },
      actor,
      db,
    );
    await logAudit(db, {
      userId: user.id,
      userName: user.name,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: user.id,
      details: `Senha alterada pelo próprio usuário ("${user.login}")`,
    });
  },
};
