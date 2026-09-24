/** Remove acentos e normaliza texto digitado pelo usuário. */
export function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

/** Converte para MAIÚSCULAS removendo acentos (útil em códigos). */
export function toUpperNoAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * Gera um nome de arquivo seguro para download.
 * Remove/replace caracteres inválidos em Windows e sistemas Unix.
 */
export function sanitizeFileName(name: string): string {
  return toUpperNoAccents(name)
    .replace(/[^A-Z0-9\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/** Escapa texto exibido fora do React (canvas, atributos, etc.). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Corta texto longo preservando legibilidade. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}
