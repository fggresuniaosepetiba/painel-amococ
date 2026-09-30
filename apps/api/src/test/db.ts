import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./global-setup.js";

// Cliente Prisma apontado para o banco de TESTE. Serviços aceitam injeção,
// então nenhum teste toca no banco de desenvolvimento.
export function createTestClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
}

/** Limpa as 7 tabelas entre testes (sem FKs — qualquer ordem serve). */
export async function resetDatabase(db: PrismaClient): Promise<void> {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.membershipCard.deleteMany(),
    db.member.deleteMany(),
    db.setting.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
    db.usedIdentifier.deleteMany(),
  ]);
}
