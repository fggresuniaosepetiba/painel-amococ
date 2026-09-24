import { z } from "zod";
import { isValidCpf, isValidDateBr } from "@/utils/format";

export const memberSchema = z.object({
  membershipNumber: z.string(),
  cardCode: z.string(),
  fullName: z
    .string()
    .min(3, "Informe o nome completo.")
    .max(120, "Nome muito longo."),
  cpf: z.string().refine((v) => v.trim() === "" || isValidCpf(v), {
    message: "CPF inválido. Verifique os dígitos.",
  }),
  birthDate: z.string().refine((v) => v === "" || isValidDateBr(v), {
    message: "Data de nascimento inválida. Use dd/mm/aaaa.",
  }),
  phone: z.string().refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, {
    message: "Telefone inválido.",
  }),
  whatsapp: z
    .string()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, {
      message: "WhatsApp inválido.",
    }),
  cep: z.string(),
  address: z.string().max(160, "Endereço muito longo."),
  addressNumber: z.string().max(20),
  complement: z.string().max(80),
  district: z.string().max(80),
  city: z.string().max(80),
  state: z.string().max(2),
  photoDataUrl: z.string().nullable(),
  notes: z.string().max(1000, "Observações muito longas."),
});

export type MemberFormValues = z.infer<typeof memberSchema>;
