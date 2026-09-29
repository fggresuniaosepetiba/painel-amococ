import type { Permission } from "./permissions";

export type Role = "SUPERADMIN" | "ADMINISTRADOR" | "COLABORADOR";
export type UserStatus = "ATIVO" | "INATIVO";
export type MemberStatus = "ATIVO" | "INATIVO";

export interface User {
  id: string;
  name: string;
  login: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: Permission[];
  salt: string;
  passwordHash: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

/** Dados públicos do usuário (sem credenciais). */
export type PublicUser = Omit<User, "salt" | "passwordHash">;

export interface Member {
  id: string;
  /** Matrícula administrativa — imutável, ex.: "000001" */
  membershipNumber: string;
  /** Código da carteirinha — imutável, ex.: "AMOCOC-00001-A8ZK" */
  cardCode: string;
  fullName: string;
  cpf: string;
  birthDate: string; // ISO yyyy-mm-dd
  phone: string;
  whatsapp: string;
  cep: string;
  address: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  photoDataUrl: string | null;
  notes: string;
  status: MemberStatus;
  /** Data/hora em que foi inativado (null enquanto estiver ativo). */
  inactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipCardRecord {
  id: string;
  memberId: string;
  cardCode: string;
  membershipNumber: string;
  memberName: string;
  generatedAt: string;
  generatedByUserId: string;
  generatedByName: string;
  /** PNG gerado (data URL) — reutilizado no download. */
  pngDataUrl: string | null;
  fileSizeBytes: number | null;
}

export interface AssociationSettings {
  name: string;
  acronym: string;
  address: string;
  phone: string;
  email: string;
  information: string;
  customLogoDataUrl: string | null;
}

export interface CardSettings {
  title: string;
  footerText: string;
  showCpf: boolean;
  showBirthDate: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showIssueDate: boolean;
  /**
   * Posição/tamanho personalizados da assinatura na carteirinha,
   * em px lógicos do cartão (600×378). `null` = posição padrão
   * (colado na linha de assinatura, à direita).
   */
  signaturePlacement: SignaturePlacement | null;
}

export interface SignaturePlacement {
  /** Canto superior esquerdo da imagem, em px lógicos (0–600). */
  x: number;
  /** Canto superior esquerdo da imagem, em px lógicos (0–378). */
  y: number;
  /** Largura da imagem em px lógicos; a altura preserva a proporção. */
  width: number;
}

export interface SignatureSettings {
  presidentName: string;
  presidentTitle: string;
  imageDataUrl: string | null;
  mimeType: string | null;
  updatedAt: string | null;
}

export interface SecuritySettings {
  lastPasswordChangeAt: string | null;
}

export interface AppSettings {
  id: "general";
  association: AssociationSettings;
  card: CardSettings;
  signature: SignatureSettings;
  security: SecuritySettings;
  updatedAt: string;
}

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "MEMBER_CREATED"
  | "MEMBER_UPDATED"
  | "MEMBER_INACTIVATED"
  | "MEMBER_REACTIVATED"
  | "MEMBER_DELETED"
  | "CARD_GENERATED"
  | "CARD_DOWNLOADED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_INACTIVATED"
  | "USER_REACTIVATED"
  | "PERMISSION_CHANGED"
  | "SETTINGS_UPDATED"
  | "SIGNATURE_UPDATED"
  | "PASSWORD_CHANGED"
  | "SYSTEM_FACTORY_RESET";

export interface AuditLog {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  details: string;
}

export interface SessionInfo {
  userId: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * REGRA CRÍTICA — identificador já emitido (matrícula ou código de
 * carteirinha). Estes registros formam a reserva PERMANENTE de
 * identificadores: nunca são apagados, mesmo quando o associado é
 * excluído definitivamente, e portanto nunca poderão ser reutilizados.
 */
export interface UsedIdentifier {
  /** Valor único (PK): "000027" ou "AMOCOC-00027-X4P9". */
  value: string;
  type: "membershipNumber" | "cardCode";
  /** Quando o identificador foi emitido pela primeira vez. */
  usedAt: string;
  /** ID do associado na época da emissão (mantido como histórico). */
  memberId: string | null;
  /** Nome do associado na época da emissão (mantido como histórico). */
  memberName: string;
}
