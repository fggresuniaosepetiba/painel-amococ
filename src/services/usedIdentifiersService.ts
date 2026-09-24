import { membersRepository, usedIdentifiersRepository } from "@/repositories";
import type { Member, UsedIdentifier } from "@/types";

/**
 * REGRA CRÍTICA — RESERVA PERMANENTE DE IDENTIFICADORES.
 *
 * Toda matrícula e todo código de carteirinha já emitidos são registrados
 * nesta base, que **nunca** é afetada pela exclusão definitiva de um
 * associado. Identificadores utilizados jamais poderão ser reutilizados.
 *
 * - `register()` é idempotente: o primeiro registro é a história definitiva.
 * - `backfill()` protege bases legadas (criadas antes desta reserva),
 *   registrando os identificadores de todos os associados existentes.
 */
export const usedIdentifiersService = {
  async getAll(): Promise<UsedIdentifier[]> {
    return usedIdentifiersRepository.getAll();
  },

  /** Este valor já foi emitido alguma vez (associado existente ou excluído)? */
  async isUsed(value: string): Promise<boolean> {
    return usedIdentifiersRepository.isUsed(value);
  },

  /** Reserva os identificadores de um associado (idempotente). */
  async register(
    member: Pick<
      Member,
      "id" | "fullName" | "membershipNumber" | "cardCode"
    >
  ): Promise<void> {
    const usedAt = new Date().toISOString();
    const entries: UsedIdentifier[] = [
      {
        value: member.membershipNumber,
        type: "membershipNumber",
        usedAt,
        memberId: member.id,
        memberName: member.fullName,
      },
      {
        value: member.cardCode,
        type: "cardCode",
        usedAt,
        memberId: member.id,
        memberName: member.fullName,
      },
    ];
    for (const entry of entries) {
      await usedIdentifiersRepository.register(entry);
    }
  },

  /**
   * Retrocompatibilidade: registra os identificadores de associados que já
   * existiam antes da criação da reserva (executado na inicialização do
   * aplicativo e após a restauração de fábrica).
   */
  async backfill(): Promise<void> {
    const members = await membersRepository.getAll();
    for (const member of members) {
      await this.register(member);
    }
  },
};
