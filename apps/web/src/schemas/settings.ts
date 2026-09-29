import { z } from "zod";

export const associationSettingsSchema = z.object({
  name: z.string().min(3, "Informe o nome da associação.").max(160),
  acronym: z.string().min(2, "Informe a sigla.").max(20),
  address: z.string().max(200),
  phone: z.string().max(30),
  email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "E-mail inválido.",
  }),
  information: z.string().max(1000),
});

export type AssociationSettingsFormValues = z.infer<
  typeof associationSettingsSchema
>;

export const cardSettingsSchema = z.object({
  title: z.string().min(2, "Informe o título.").max(60),
  footerText: z.string().max(140),
  showCpf: z.boolean(),
  showBirthDate: z.boolean(),
  showPhone: z.boolean(),
  showAddress: z.boolean(),
  showIssueDate: z.boolean(),
  signaturePlacement: z
    .object({
      x: z.number().min(0).max(600),
      y: z.number().min(0).max(378),
      width: z.number().min(60).max(420),
    })
    .nullable(),
});

export type CardSettingsFormValues = z.infer<typeof cardSettingsSchema>;

export const signatureSettingsSchema = z.object({
  presidentName: z.string().max(120),
  presidentTitle: z.string().max(80),
});

export type SignatureSettingsFormValues = z.infer<
  typeof signatureSettingsSchema
>;
