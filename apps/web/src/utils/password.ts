/**
 * Hash de senhas usando Web Crypto (SHA-256 + salt aleatório por usuário).
 *
 * ATENÇÃO: esta é uma solução local/prototipagem. A versão de produção
 * utilizará backend com hash forte (Argon2/bcrypt) no servidor.
 * A senha em texto puro NUNCA é armazenada nem registrada em auditoria.
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export interface PasswordHash {
  salt: string;
  hash: string;
}

export async function hashPassword(plain: string): Promise<PasswordHash> {
  const salt = randomSalt();
  const hash = await sha256Hex(`${salt}:${plain}`);
  return { salt, hash };
}

export async function verifyPassword(
  plain: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const hash = await sha256Hex(`${salt}:${plain}`);
  // comparação em tempo constante simples
  if (hash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}
