import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

// Garante o banco ISOLADO de testes: cria amococ_test (se ausente) e aplica
// as migrations. Nunca toca no banco de desenvolvimento.

export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://amococ:amococ_dev@localhost:5432/amococ_test?schema=public";

function adminUrl(): string {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

export default async function globalSetup(): Promise<void> {
  const admin = new PrismaClient({ datasourceUrl: adminUrl() });
  try {
    await admin.$executeRawUnsafe("CREATE DATABASE amococ_test");
  } catch {
    // já existe — segue
  } finally {
    await admin.$disconnect();
  }
  execSync("prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
