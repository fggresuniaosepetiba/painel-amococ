import { membersRepository } from "@/repositories";

/**
 * REGRA CRÍTICA — CÓDIGO DA CARTEIRINHA.
 *
 * Padrao: AMOCOC-00001-A8ZK  (prefixo + sequencial + sufixo alfanumérico)
 *
 * - Único, gerado automaticamente.
 * - Nunca editado, nunca reutilizado.
 * - Permanece vinculado ao associado (inclusive inativo).
 * - Unicidade garantida pelo índice único do banco + checagem de colisão.
 */
const PREFIX = "AMOCOC";
/** Alfabeto sem caracteres ambíguos (sem I, O, 0, 1). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SUFFIX_LENGTH = 4;
const MAX_ATTEMPTS = 50;

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function build(sequential: string, suffix: string): string {
  return `${PREFIX}-${sequential}-${suffix}`;
}

export const membershipCardCodeService = {
  PREFIX,

  /** Monta um código a partir de matrícula e sufixo (uso no formulário). */
  build(membershipNumber: string, suffix?: string): string {
    const sequential = membershipNumber.slice(-5);
    return build(sequential, suffix ?? randomSuffix(SUFFIX_LENGTH));
  },

  /** Rótulo do sufixo exibido como "preview" travado no formulário. */
  buildPreview(membershipNumber: string): string {
    return this.build(membershipNumber);
  },

  /**
   * Gera um código garantidamente não utilizado.
   * Proteção contra colisões: checa o banco e regenera o sufixo se preciso.
   */
  async generateUnique(membershipNumber: string): Promise<string> {
    const sequential = membershipNumber.slice(-5);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = build(sequential, randomSuffix(SUFFIX_LENGTH));
      // isCardCodeTaken cobre associados existentes E a reserva permanente
      // (códigos de associados excluídos definitivamente nunca saem de lá).
      const taken = await membersRepository.isCardCodeTaken(code);
      if (!taken) return code;
    }
    // Fallback: estende o sufixo para reduzir ainda mais a colisão.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = build(sequential, randomSuffix(SUFFIX_LENGTH + 2));
      const taken = await membersRepository.isCardCodeTaken(code);
      if (!taken) return code;
    }
    throw new Error("CARD_CODE_GENERATION_FAILED");
  },

  isValid(code: string): boolean {
    return /^AMOCOC-\d{5}-[A-Z2-9]{4,6}$/.test(code);
  },

  /** Nome de arquivo: AMOCOC-00001-A8ZK-NOME-DO-ASSOCIADO.png */
  buildFileName(code: string, memberName: string, extension = "png"): string {
    const normalizedName = memberName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    return `${code}-${normalizedName || "ASSOCIADO"}.${extension}`;
  },
};
