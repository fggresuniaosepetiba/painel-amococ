import { z } from "zod";
import { isValidCpf, isValidDateBr } from "@/utils/format";

/**
 * Declaração de residência — formulário SEMPRE manual (regra definida com a
 * diretoria): nada é puxado de associados. A data chega em BR (dd/mm/aaaa)
 * e o CPF mantém a mesma validação dos demais formulários.
 */
export const declarationSchema = z.object({
  residentName: z
    .string()
    .trim()
    .min(3, "Informe o nome do morador.")
    .max(120, "Nome muito longo."),
  birthDate: z.string().refine((v) => v !== "" && isValidDateBr(v), {
    message: "Data de nascimento inválida. Use dd/mm/aaaa.",
  }),
  cpf: z.string().refine((v) => v.trim() === "" || isValidCpf(v), {
    message: "CPF inválido. Verifique os dígitos.",
  }),
  cep: z.string().refine((v) => v.trim() === "" || v.replace(/\D/g, "").length === 8, {
    message: "CEP inválido. Use 00000-000.",
  }),
  address: z
    .string()
    .trim()
    .min(3, "Informe o endereço (rua, avenida...).")
    .max(160, "Endereço muito longo."),
  addressNumber: z
    .string()
    .trim()
    .min(1, "Informe o número.")
    .max(20, "Número muito longo."),
  complement: z.string().trim().max(80, "Complemento muito longo."),
  district: z
    .string()
    .trim()
    .min(2, "Informe o bairro.")
    .max(80, "Bairro muito longo."),
  city: z
    .string()
    .trim()
    .min(2, "Informe a cidade.")
    .max(80, "Cidade muito longa."),
  state: z
    .string()
    .trim()
    .length(2, "Informe a UF (ex.: RJ)."),
  residenceYears: z
    .number({ message: "Informe os anos de residência." })
    .int("Anos de residência inválidos.")
    .min(0, "Anos de residência inválidos.")
    .max(130, "Anos de residência inválidos."),
  residenceMonths: z
    .number({ message: "Informe os meses de residência." })
    .int("Meses de residência inválidos.")
    .min(0, "Meses de residência inválidos.")
    .max(11, "Use meses de 0 a 11."),
});

export type DeclarationFormValues = z.infer<typeof declarationSchema>;
