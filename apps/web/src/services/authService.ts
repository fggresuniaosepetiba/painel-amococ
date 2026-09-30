import { SESSION_NOTICE_KEY, SESSION_STORAGE_KEY } from "@/constants";
import { api, isUnauthorized } from "@/lib/apiClient";
import type { PublicUser } from "@amococ/shared";
import { authorizationService } from "./authorizationService";

/** Motivos de encerramento exibidos na tela de login. */
export type SessionNotice = "IDLE_TIMEOUT" | "SESSION_EXPIRED";

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

/** Par de tokens + usuário retornado pelo login/refresh (Fase 5, JWT). */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

/** Sessão persistida (só sessionStorage — nunca localStorage). */
interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

function readStoredSession(): StoredSession | null {
  try {
    // REGRA OBRIGATÓRIA (LGPD): a sessão é POR ABA (sessionStorage) —
    // fechar a aba encerra a sessão e a próxima abertura exige login.
    // Sessões antigas em localStorage (legado) são descartadas aqui.
    // Formatos antigos (SessionInfo pre-Fase-5) são descartados.
    localStorage.removeItem(SESSION_STORAGE_KEY);
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.user?.id !== "string"
    ) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Autenticação por JWT (Fase 5).
 * O servidor valida credenciais, permissões (por endpoint) e auditoria
 * (LOGIN/LOGOUT registrados lá — fonte única, ADR-015).
 *
 * REGRAS OBRIGATÓRIAS DE SESSÃO (LGPD):
 * 1. Tokens vivem em `sessionStorage` (escopo de ABA): fechar a aba
 *    encerra a sessão e a próxima abertura exige login novamente.
 * 2. Após 15 MINUTOS de inatividade a sessão é encerrada automaticamente
 *    (ver `sessionGuard`), com aviso explicativo exibido em /login.
 * 3. Access expira em 15 min; o refresh (opaco, 7 dias) o renova
 *    silenciosamente. 401 irrecuperável = logout + aviso em /login.
 */
export const authService = {
  /** Access atual para o `Authorization: Bearer` (via apiClient). */
  getAccessToken(): string | null {
    return readStoredSession()?.accessToken ?? null;
  },

  /**
   * Renova o par via refresh (chamado pelo apiClient em 401).
   * Retorna o novo access ou `null` (sessão morta — já limpa).
   */
  async refreshTokens(): Promise<string | null> {
    const stored = readStoredSession();
    if (!stored) return null;
    try {
      const data = await api<LoginResponse>("/api/auth/refresh", {
        method: "POST",
        auth: "none",
        body: { refreshToken: stored.refreshToken },
      });
      writeStoredSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      return data.accessToken;
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },

  /** Limpa a sessão local. Retorna se havia sessão (p/ decidir o aviso). */
  clearSession(): boolean {
    const had = readStoredSession() !== null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return had;
  },

  async login(login: string, password: string): Promise<PublicUser> {
    let data: LoginResponse;
    try {
      data = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        auth: "none",
        body: { login: login.trim().toLowerCase(), password },
      });
    } catch (err) {
      // Mensagem única §14 (servidor não distingue motivo — nem INATIVO).
      if (isUnauthorized(err)) {
        throw new AuthError(
          "Usuário ou senha incorretos. Verifique os dados e tente novamente.",
          "INVALID_CREDENTIALS"
        );
      }
      throw err;
    }
    sessionStorage.removeItem(SESSION_NOTICE_KEY); // não herda aviso antigo
    writeStoredSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    return data.user;
  },

  /**
   * Restaura a sessão da aba (boot/refresh): valida no servidor (`/me`,
   * que passa pelo refresh silencioso do apiClient) e devolve o usuário
   * atualizado. Falha = sessão morta (já limpa) → `null`.
   */
  async restoreSession(): Promise<PublicUser | null> {
    if (!readStoredSession()) return null;
    try {
      const user = await api<PublicUser>("/api/auth/me");
      const stored = readStoredSession();
      if (stored) writeStoredSession({ ...stored, user });
      return user;
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },

  async logout(): Promise<void> {
    const stored = readStoredSession();
    try {
      // O refresh no corpo é a credencial (cobre access expirado e o
      // encerramento por inatividade). O servidor audita LOGOUT.
      await api("/api/auth/logout", {
        method: "POST",
        auth: "none",
        body: { refreshToken: stored?.refreshToken },
      });
    } catch {
      // Logout local sempre acontece, mesmo sem rede/servidor.
    } finally {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  },

  /**
   * Registra o motivo de um encerramento da sessão (inatividade ou 401).
   * A tela de login lê e limpa esse aviso para explicar o ocorrido.
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
      return value === "IDLE_TIMEOUT" || value === "SESSION_EXPIRED"
        ? value
        : null;
    } catch {
      return null;
    }
  },

  /** Altera a senha do próprio usuário autenticado (ator = token). */
  async changeOwnPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "A senha atual está incorreta."
      ) {
        throw new AuthError(err.message, "INVALID_CREDENTIALS");
      }
      throw err;
    }
  },

  authorizationService,
};
