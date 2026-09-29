import { db } from "@/db/database";
import type { UsedIdentifier } from "@amococ/shared";
import type { UsedIdentifiersRepository } from "../types";

/**
 * Implementação IndexedDB da reserva permanente de identificadores.
 *
 * A tabela `usedIdentifiers` tem chave primária no valor e não participa de
 * nenhuma operação de exclusão de associados: uma vez registrada, uma
 * matrícula ou um código ficam reservados para sempre.
 */
export class IndexedDbUsedIdentifiersRepository
  implements UsedIdentifiersRepository
{
  getAll(): Promise<UsedIdentifier[]> {
    return db.usedIdentifiers.orderBy("usedAt").toArray();
  }

  async isUsed(value: string): Promise<boolean> {
    return Boolean(await db.usedIdentifiers.get(value));
  }

  async register(record: UsedIdentifier): Promise<void> {
    const existing = await db.usedIdentifiers.get(record.value);
    // Idempotente: o primeiro registro é a história do identificador e
    // nunca é sobrescrito por registros posteriores.
    if (existing) return;
    await db.usedIdentifiers.add(record);
  }
}
