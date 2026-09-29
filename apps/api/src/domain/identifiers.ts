import { randomBytes } from "node:crypto";

// Regras puras de identificadores — cópia fiel da lógica do frontend
// (membershipNumberService, membershipCardCodeService, isValidCpf).
// Sem acesso a banco: recebem dados e decidem. Testáveis sem infraestrutura.

// --- Matrícula (6 dígitos, zero à esquerda) ---

export function formatMembershipNumber(raw: number): string {
  return String(raw).padStart(6, "0");
}

export function isValidMembershipNumber(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/**
 * Próxima matrícula = max(associados existentes, reserva permanente) + 1.
 * Matrícula excluída continua contando — nunca reutilizada.
 */
export function nextMembershipNumber(
  memberMax: number | null,
  usedValues: number[],
): string {
  let max = memberMax !== null && Number.isFinite(memberMax) ? memberMax : 0;
  for (const value of usedValues) {
    if (Number.isFinite(value) && value > max) max = value;
  }
  return formatMembershipNumber(max + 1);
}

// --- Código da carteirinha (AMOCOC-00001-A8ZK) ---

export const CARD_CODE_PREFIX = "AMOCOC";
/** Alfabeto sem caracteres ambíguos (sem I, O, 0, 1). */
const CARD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CARD_SUFFIX_LENGTH = 4;
const CARD_MAX_ATTEMPTS = 50;

function randomSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CARD_ALPHABET[bytes[i]! % CARD_ALPHABET.length];
  }
  return out;
}

export function buildCardCode(membershipNumber: string, suffix?: string): string {
  const sequential = membershipNumber.slice(-5);
  return `${CARD_CODE_PREFIX}-${sequential}-${suffix ?? randomSuffix(CARD_SUFFIX_LENGTH)}`;
}

export function isValidCardCode(code: string): boolean {
  return /^AMOCOC-\d{5}-[A-Z2-9]{4,6}$/.test(code);
}

/**
 * Gera código garantidamente não utilizado (associados + reserva permanente).
 * 50 tentativas com sufixo de 4, depois 50 com sufixo de 6 — senão falha.
 */
export async function generateUniqueCardCode(
  membershipNumber: string,
  isTaken: (code: string) => Promise<boolean>,
): Promise<string> {
  const sequential = membershipNumber.slice(-5);
  for (let attempt = 0; attempt < CARD_MAX_ATTEMPTS; attempt++) {
    const code = `${CARD_CODE_PREFIX}-${sequential}-${randomSuffix(CARD_SUFFIX_LENGTH)}`;
    if (!(await isTaken(code))) return code;
  }
  for (let attempt = 0; attempt < CARD_MAX_ATTEMPTS; attempt++) {
    const code = `${CARD_CODE_PREFIX}-${sequential}-${randomSuffix(CARD_SUFFIX_LENGTH + 2)}`;
    if (!(await isTaken(code))) return code;
  }
  throw new Error("CARD_CODE_GENERATION_FAILED");
}

/** Nome de arquivo: AMOCOC-00001-A8ZK-NOME-DO-ASSOCIADO.png */
export function buildCardFileName(
  code: string,
  memberName: string,
  extension = "png",
): string {
  const normalized = memberName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${code}-${normalized || "ASSOCIADO"}.${extension}`;
}

// --- Validações de formato (espelham schemas do frontend) ---

/** CPF válido pelo algoritmo dos dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number): number => {
    let total = 0;
    for (let i = 0; i < base.length; i++) total += Number(base[i]) * (factor - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/** Data ISO yyyy-mm-dd real (sem conversão de fuso — string opaca). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m! - 1 &&
    date.getUTCDate() === d
  );
}
