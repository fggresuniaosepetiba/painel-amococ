// Camada de configuração: única responsável por ler e validar variáveis de
// ambiente. Nenhum outro módulo acessa process.env diretamente.

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "3000");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

function parseOrigins(value: string | undefined): string[] {
  const origins = (value ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : ["http://localhost:5173"];
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  apiPort: parsePort(process.env["API_PORT"]),
  corsOrigins: parseOrigins(process.env["CORS_ORIGINS"]),
  databaseUrl: process.env["DATABASE_URL"] ?? "",
  // Segredo do JWT (Fase 5). Em produção, definir JWT_SECRET forte;
  // em dev/teste, o fallback abaixo é aceitável (documentado no .env.example).
  jwtSecret: process.env["JWT_SECRET"] ?? "dev-local-insecure-secret",
  // Rate-limit do login: tentativas por janela de 15 min por IP (Fase 5).
  // LOGIN_RATE_LIMIT_MAX permite aos testes configurar um teto baixo.
  loginRateLimitMax: parsePositiveInt(process.env["LOGIN_RATE_LIMIT_MAX"], 20),
} as const;

export const isProduction = env.nodeEnv === "production";
