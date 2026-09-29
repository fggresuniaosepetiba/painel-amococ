import { PrismaClient } from "@prisma/client";

// Instância única do PrismaClient (singleton). Em desenvolvimento com
// recarregamento (tsx watch), o cache global evita esgotar conexões.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
