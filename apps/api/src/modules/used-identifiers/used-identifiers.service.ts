import type { UsedIdentifier } from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import type { Db } from "../../shared/db.js";
import { usedIdentifiersRepository } from "./used-identifiers.repository.js";

// Reserva permanente — leitura e registro idempotente. Nenhum endpoint apaga.
export const usedIdentifiersService = {
  list(db: Db = prisma): Promise<UsedIdentifier[]> {
    return usedIdentifiersRepository.getAll(db);
  },

  isUsed(value: string, db: Db = prisma): Promise<boolean> {
    return usedIdentifiersRepository.isUsed(db, value);
  },

  register(record: UsedIdentifier, db: Db = prisma): Promise<void> {
    return usedIdentifiersRepository.register(db, record);
  },
};
