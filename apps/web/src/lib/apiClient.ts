/**
 * Cliente HTTP da API (Fase 4: o frontend consome o backend).
 *
 * - `baseURL = VITE_API_URL` (default `http://localhost:3000`).
 * - Traduz o envelope `{status:"error",code,message}` em `ApiError`
 *   preservando o `code` (mensagens exatas §14 e códigos tratados na UI).
 * - 404 vira `ApiError` com `status: 404` — os repositories convertem
 *   em `undefined` onde a interface promete (getById/getByLogin/...).
 * - Toda mutação leva o `actor` da sessão atual (via `setActorProvider`,
 *   configurado pelo `AuthProvider`); sem sessão, o servidor registra
 *   como sistema (ADR-010). Tokens entram na Fase 5.
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

const BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || "http://localhost:3000";

export interface SessionActor {
  id: string;
  name: string;
}

type ActorProvider = () => SessionActor | null;

let actorProvider: ActorProvider = () => null;

/** Configurado pelo AuthProvider (login/logout/refresh). */
export function setActorProvider(fn: ActorProvider): void {
  actorProvider = fn;
}

/** Corpo `{actor}` para mutações — `null` sem sessão (vira sistema no servidor). */
export function actorBody(): { actor: SessionActor | null } {
  try {
    return { actor: actorProvider() };
  } catch {
    return { actor: null };
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 60000
  );
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
}
