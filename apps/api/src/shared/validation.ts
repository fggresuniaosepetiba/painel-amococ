import { z } from "zod";
import { isValidCpf, isValidIsoDate } from "../domain/identifiers.js";
import { isPermission } from "../domain/permissions.js";

// Validação de entrada HTTP (espelha apps/web/src/schemas + regras de serviço).
// Erros viram 400 VALIDATION_ERROR com a primeira mensagem.

const nonEmptyTrimmed = (max: number) =>
  z.string().trim().min(1).max(max);

const optionalText = (max: number) => z.string().max(max).default("");

const phoneField = (label: string) =>
  z
    .string()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, {
      message: `${label} inválido.`,
    })
    .default("");

export const actorSchema = z
  .object({ id: z.string().min(1), name: z.string() })
  .nullish();

export const memberDraftSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo.")
    .max(120, "Nome muito longo."),
  cpf: z.string().refine((v) => v.trim() === "" || isValidCpf(v), {
    message: "CPF inválido. Verifique os dígitos.",
  }),
  birthDate: z.string().refine((v) => v === "" || isValidIsoDate(v), {
    message: "Data de nascimento inválida. Use aaaa-mm-dd.",
  }),
  phone: phoneField("Telefone"),
  whatsapp: phoneField("WhatsApp"),
  cep: z.string().max(20).default(""),
  address: z.string().max(160).default(""),
  addressNumber: z.string().max(20).default(""),
  complement: z.string().max(80).default(""),
  district: z.string().max(80).default(""),
  city: z.string().max(80).default(""),
  state: z.string().max(2).default(""),
  photoDataUrl: z.string().nullable().default(null),
  notes: z.string().max(1000, "Observações muito longas.").default(""),
  // Identificadores opcionais (import/migração): se ausentes, gerados no servidor.
  membershipNumber: z.string().optional(),
  cardCode: z.string().optional(),
  actor: actorSchema,
});

export type MemberDraftInput = z.infer<typeof memberDraftSchema>;

const ROLES = ["SUPERADMIN", "ADMINISTRADOR", "COLABORADOR"] as const;
const USER_STATUSES = ["ATIVO", "INATIVO"] as const;

export const userDraftSchema = z.object({
  name: nonEmptyTrimmed(120),
  login: nonEmptyTrimmed(80),
  email: z.string().trim().max(160).default(""),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  permissions: z
    .array(z.string())
    .refine((list) => list.every(isPermission), {
      message: "Permissão inválida.",
    })
    .default([]),
  initialPassword: z.string().min(1, "Informe a senha inicial."),
  actor: actorSchema,
});

export const userUpdateSchema = userDraftSchema.omit({ initialPassword: true });

export const userStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
  actor: actorSchema,
});

export const userPermissionsSchema = z.object({
  permissions: z
    .array(z.string())
    .refine((list) => list.every(isPermission), {
      message: "Permissão inválida.",
    }),
  actor: actorSchema,
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(1, "Informe a nova senha."),
  actor: actorSchema,
});

export const cardGenerateSchema = z.object({
  memberId: z.string().min(1),
  pngDataUrl: z.string().min(1, "PNG da carteirinha ausente."),
  actor: actorSchema,
});

export const settingsSaveSchema = z.object({
  association: z
    .object({
      name: z.string().max(160),
      acronym: z.string().max(20),
      address: z.string().max(200),
      phone: z.string().max(40),
      email: z.string().max(160),
      information: z.string().max(2000),
      customLogoDataUrl: z.string().nullable(),
    })
    .partial(),
  card: z
    .object({
      title: z.string().max(120),
      footerText: z.string().max(200),
      showCpf: z.boolean(),
      showBirthDate: z.boolean(),
      showPhone: z.boolean(),
      showAddress: z.boolean(),
      showIssueDate: z.boolean(),
      signaturePlacement: z
        .object({
          x: z.number().min(0).max(600),
          y: z.number().min(0).max(378),
          width: z.number().min(1).max(600),
        })
        .nullable(),
    })
    .partial(),
  security: z
    .object({ lastPasswordChangeAt: z.string().nullable() })
    .partial(),
  actor: actorSchema,
});

export const signatureSaveSchema = z.object({
  presidentName: z.string().max(120).optional(),
  presidentTitle: z.string().max(120).optional(),
  imageDataUrl: z.string().nullable().optional(),
  mimeType: z.string().max(80).nullable().optional(),
  actor: actorSchema,
});

export const usedIdentifierRegisterSchema = z.object({
  value: z.string().min(1),
  type: z.enum(["membershipNumber", "cardCode"]),
  memberId: z.string().nullable().default(null),
  memberName: z.string().max(120),
});

export const auditCreateSchema = z.object({
  userId: z.string().nullable().default(null),
  userName: z.string().min(1).max(120),
  action: z.string().min(1).max(60),
  entity: z.string().max(80),
  entityId: z.string().max(120).nullable().default(null),
  details: z.string().max(4000),
});
