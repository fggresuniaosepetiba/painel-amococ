import { membersRepository } from "@/repositories";

/**
 * REGRA CRÍTICA — MATRÍCULA.
 *
 * - Gerada automaticamente (sequencial numérico).
 * - Única, pessoal e imutável.
 * - Não pode ser editada, reutilizada nem apagada.
 * - Permanece associada ao associado mesmo após inativação.
 *
 * Toda a lógica fica isolada neste serviço: para mudar a regra no futuro,
 * basta alterar este arquivo.
 */
export const membershipNumberService = {
  /** Formata o número bruto no padrão administrativo (6 dígitos). */
  format(raw: number): string {
    return String(raw).padStart(6, "0");
  },

  /** Próxima matrícula disponível (exibida travada no formulário). */
  async previewNext(): Promise<string> {
    return membersRepository.nextMembershipNumber();
  },

  /** Valida o formato de uma matrícula. */
  isValid(membershipNumber: string): boolean {
    return /^\d{6}$/.test(membershipNumber);
  },
};
