/**
 * Cliente HTTP da API (Fase 5: autenticação por token).
 *
 * - `baseURL = VITE_API_URL` (default `http://localhost:3000`).
 * - Traduz o envelope `{status:"error",code,message}` em `ApiError`
 *   preservando o `code` (mensagens exatas §14 e códigos tratados na UI).
 * - 404 vira `ApiError` com `status: 404` — os repositories convertem
 *   em `undefined` onde a interface promete (getById/getByLogin/...).
 * - Chamadas autenticadas levam `Authorization: Bearer <access>` (token
 *   fornecido pelo `authService` via `setAuthHandlers`, configurado pelo
 *   `AuthProvider`). Em 401, tenta UMA vez o refresh (voo único
 *   compartilhado entre chamadas concorrentes) e repete a original; se o
 *   refresh falhar, dispara `onUnauthorized` (logout + aviso no /login).
 * - Rotas públicas (login, refresh, seed) usam `auth: "none"`: sem Bearer
 *   e sem tentativa de refresh (evita laço).
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

const BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || "http://localhost:3000";

interface AuthHandlers {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}

let handlers: AuthHandlers | null = null;
/** Refresh em voo (compartilhado — evita N rotações em 401s concorrentes). */
let refreshPromise: Promise<string | null> | null = null;

/** Configurado pelo AuthProvider (login/logout/refresh). */
export function setAuthHandlers(next: AuthHandlers): void {
  handlers = next;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  /** "auto" (default): Bearer + refresh em 401. "none": rota pública. */
  auth?: "auto" | "none";
}

function doFetch<T>(
  path: string,
  options: ApiOptions,
  accessToken: string | null
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 60000
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return (async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        data?: T;
        code?: string;
        message?: string;
      } | null;
      if (!res.ok || json?.status === "error") {
        throw new ApiError(
          json?.message ?? `Falha na requisição (HTTP ${res.status}).`,
          json?.code ?? "HTTP_ERROR",
          res.status
        );
      }
      return (json?.data ?? null) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        err instanceof Error ? err.message : "Falha de rede.",
        "NETWORK_ERROR",
        0
      );
    } finally {
      clearTimeout(timer);
    }
  })();
}

export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const useAuth = options.auth ?? "auto";
  const access = useAuth === "auto" ? (handlers?.getAccessToken() ?? null) : null;
  try {
    return await doFetch<T>(path, options, access);
  } catch (err) {
    if (
      useAuth !== "auto" ||
      !isUnauthorized(err) ||
      !handlers ||
      // A própria rota de refresh nunca se auto-recupera (evita laço).
      path === "/api/auth/refresh"
    ) {
      throw err;
    }
    if (!refreshPromise) {
      refreshPromise = handlers
        .refreshAccessToken()
        .finally(() => {
          refreshPromise = null;
        });
    }
    const renewed = await refreshPromise;
    if (!renewed) {
      handlers.onUnauthorized();
      throw err;
    }
    return doFetch<T>(path, options, renewed);
  }
}
