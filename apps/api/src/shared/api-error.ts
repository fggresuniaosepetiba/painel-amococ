// Erro de domínio com status HTTP. Serviços lançam códigos de negócio
// (ex.: "MEMBER_NOT_FOUND"); a tradução para HTTP acontece aqui.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title?: string;

  constructor(status: number, code: string, message?: string, title?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.title = title;
  }
}

/** Códigos de domínio → status HTTP (autorização: middlewares lançam ApiError direto). */
const STATUS_BY_CODE: Record<string, number> = {
  MEMBER_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  CARD_NOT_FOUND: 404,
  SETTINGS_NOT_FOUND: 404,
  IDENTIFIER_ALREADY_USED: 409,
  MEMBERSHIP_NUMBER_TAKEN: 409,
  CARD_CODE_TAKEN: 409,
  LOGIN_ALREADY_EXISTS: 409,
  INVALID_BACKUP: 400,
  CANNOT_INACTIVATE_SELF: 422,
  CARD_PNG_MISSING: 422,
  FORBIDDEN: 403,
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error && err.message in STATUS_BY_CODE) {
    return new ApiError(STATUS_BY_CODE[err.message]!, err.message);
  }
  // Erro inesperado (ex.: falha do banco/driver): NUNCA relançar.
  // Os controllers chamam esta função dentro do próprio `catch`; relançar
  // geraria rejeição não tratada em handler async do Express 4, o que
  // derruba o processo Node inteiro (e o Render responde 502 vazio).
  // Devolver 500 genérico mantém o serviço de pé e o log revela a causa.
  console.error(err);
  return new ApiError(500, "INTERNAL_ERROR", "Erro interno do servidor.");
}
