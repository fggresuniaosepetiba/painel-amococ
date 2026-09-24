import {
  SESSION_DURATION_DAYS,
  SESSION_NOTICE_KEY,
  SESSION_STORAGE_KEY,
} from "@/constants";
import { usersRepository } from "@/repositories";
import type { PublicUser, SessionInfo, User } from "@/types";
import { hashPassword, verifyPassword } from "@/utils/password";
import { auditService } from "./auditService";
import { authorizationService } from "./authorizationService";

/** Motivos de encerramento automático exibidos na tela de login. */
export type SessionNotice = "IDLE_TIMEOUT";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_CREDENTIALS"
      | "INACTIVE_USER"
      | "SESSION_EXPIRED"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function toPublicUser(user: User): PublicUser {
  const { salt: _salt, passwordHash: _hash, ...rest } = user;
  return rest;
}

function readSession(): SessionInfo | null {
  try {
    // REGRA OBRIGATÓRIA (LGPD): a sessão é POR ABA (sessionStorage) —
    // fechar a aba encerra a sessão e a próxima abertura exige login.
    // Sessões antigas em localStorage (legado) são descartadas aqui.
    localStorage.removeItem(SESSION_STORAGE_KEY);
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionInfo;
    if (!parsed.userId || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(userId: string): SessionInfo {
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  const session: SessionInfo = {
    userId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

/**
 * Autenticação local (prototipagem).
 * A versão de produção terá autenticação validada no servidor.
 *
 * REGRAS OBRIGATÓRIAS DE SESSÃO (LGPD):
 * 1. A sessão vive em `sessionStorage` (escopo de ABA): fechar a aba
 *    encerra a sessão e a próxima abertura exige login novamente.
 * 2. Após 15 MINUTOS de inatividade a sessão é encerrada automaticamente
 *    (ver `sessionGuard`), com aviso explicativo exibido em /login.
 */
export const authService = {
  toPublicUser,

  async login(login: string, password: string): Promise<PublicUser> {
    const normalizedLogin = login.trim().toLowerCase();
    const user = await usersRepository.getByLogin(normalizedLogin);
    if (!user) {
      throw new AuthError(
        "Usuário ou senha incorretos. Verifique os dados e tente novamente.",
        "INVALID_CREDENTIALS"
      );
    }
    const valid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) {
      throw new AuthError(
        "Usuário ou senha incorretos. Verifique os dados e tente novamente.",
        "INVALID_CREDENTIALS"
      );
    }
    if (user.status !== "ATIVO") {
      throw new AuthError(
        "Este usuário está inativo. Procure o administrador do sistema.",
        "INACTIVE_USER"
      );
    }
    const updated = await usersRepository.update(user.id, {
      lastLoginAt: new Date().toISOString(),
    });
    sessionStorage.removeItem(SESSION_NOTICE_KEY); // não herda aviso antigo
    writeSession(updated.id);
    await auditService.log({
      userId: updated.id,
      userName: updated.name,
      action: "LOGIN",
      entity: "user",
      entityId: updated.id,
      details: `Login realizado por ${updated.login}`,
    });
    return toPublicUser(updated);
  },

  async restoreSession(): Promise<PublicUser | null> {
    const session = readSession();
    if (!session) return null;
    const user = await usersRepository.getById(session.userId);
    if (!user || user.status !== "ATIVO") {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return toPublicUser(user);
  },

  getSessionInfo(): SessionInfo | null {
    return readSession();
  },

  async logout(user: PublicUser | null): Promise<void> {
    if (user) {
      await auditService.log({
        userId: user.id,
        userName: user.name,
        action: "LOGOUT",
        entity: "user",
        entityId: user.id,
        details: `Sessão encerrada por ${user.login}`,
      });
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  },

  /**
   * Registra o motivo de um encerramento AUTOMÁTICO da sessão (ex.:
   * inatividade por 15 minutos). A tela de login lê e limpa esse aviso
   * para explicar ao usuário por que ele foi desconectado.
   */
  setSessionNotice(notice: SessionNotice): void {
    try {
      sessionStorage.setItem(SESSION_NOTICE_KEY, notice);
    } catch {
      /* armazenamento indisponível — o aviso é opcional */
    }
  },

  /** Lê e limpa o aviso pendente (chamado pela tela de login ao montar). */
  consumeSessionNotice(): SessionNotice | null {
    try {
      const value = sessionStorage.getItem(SESSION_NOTICE_KEY);
      if (!value) return null;
      sessionStorage.removeItem(SESSION_NOTICE_KEY);
      return value === "IDLE_TIMEOUT" ? value : null;
    } catch {
      return null;
    }
  },

  /** Altera a senha do próprio usuário autenticado. */
  async changeOwnPassword(
    user: PublicUser,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const stored = await usersRepository.getById(user.id);
    if (!stored) throw new AuthError("Usuário não encontrado.", "INVALID_CREDENTIALS");
    const valid = await verifyPassword(
      currentPassword,
      stored.salt,
      stored.passwordHash
    );
    if (!valid) {
      throw new AuthError("A senha atual está incorreta.", "INVALID_CREDENTIALS");
    }
    const { salt, hash } = await hashPassword(newPassword);
    await usersRepository.update(user.id, {
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    });
    await auditService.log({
      userId: user.id,
      userName: user.name,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: user.id,
      details: "Senha alterada pelo próprio usuário",
    });
  },

  authorizationService,
};
