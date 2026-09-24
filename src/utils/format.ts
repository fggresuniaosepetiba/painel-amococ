function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  // Data pura "yyyy-mm-dd": interpreta como data LOCAL. Sem isso, o parser
  // trata o valor como meia-noite UTC e em fusos negativos (ex.: UTC-3) o dia
  // "escorria" para o anterior — 05/02 era exibido como 04/02.
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formata data ISO como dd/mm/aaaa. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Formata data/hora completa: dd/mm/aaaa às hh:mm. */
export function formatDateTime(
  value: string | Date | null | undefined
): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${formatDate(date)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formata relativo amigável: agora, há 5 min, ontem, dd/mm. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return formatDate(date);
}

/** Formata telefone: (00) 00000-0000 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Formata WhatsApp: celular (DDD + 9 + 8 dígitos) usa o ponto após o 9 —
 * (21) 9.7493-4685. Fixo (8 dígitos após o DDD) mantém (00) 0000-0000.
 */
export function formatWhatsapp(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  const ddd = d.slice(0, 2);
  const isMobile = d.length >= 3 && d[2] === "9";
  if (!isMobile) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${ddd}) ${d.slice(2)}`;
    return `(${ddd}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length <= 3) return `(${ddd}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${ddd}) 9.${d.slice(3)}`;
  return `(${ddd}) 9.${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * Máscara de data para digitação: apenas dígitos no formato dd/mm/aaaa.
 * O ano é cortado estruturalmente em 4 posições (nunca 5 ou 6) e o
 * apagar/remove opera dígito a dígito como em um texto comum.
 */
export function formatDateInput(value: string): string {
  const d = value.replace(/\D/g, "");
  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const yyyy = d.slice(4, 8); // ano trava em 4 dígitos
  if (d.length <= 2) return dd;
  if (d.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

/** "1997-02-05" → "05/02/1997" (sem conversão de fuso). */
export function dateIsoToBr(value: string): string {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Valida dd/mm/aaaa como data de calendário real. */
export function isValidDateBr(value: string): boolean {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** "05/02/1997" → "1997-02-05"; vazio/inválido → "". */
export function dateBrToIso(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!isValidDateBr(value)) return "";
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Formata CPF: 000.000.000-00 */
export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata CEP: 00000-000 */
export function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Valida CPF pelo algoritmo dos dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number): number => {
    let total = 0;
    for (let i = 0; i < base.length; i++) {
      total += Number(base[i]) * (factor - i);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
