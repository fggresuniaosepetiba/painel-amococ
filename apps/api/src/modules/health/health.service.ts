import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

// Camada de serviço do health: prova a conexão com o banco via SELECT 1.
// O cliente é injetável para permitir testes sem banco real.
export async function checkDatabaseConnection(
  client: PrismaClient = prisma,
): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
