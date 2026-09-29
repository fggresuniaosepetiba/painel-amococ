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

export const env = {
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  apiPort: parsePort(process.env["API_PORT"]),
  corsOrigins: parseOrigins(process.env["CORS_ORIGINS"]),
  databaseUrl: process.env["DATABASE_URL"] ?? "",
} as const;

export const isProduction = env.nodeEnv === "production";
