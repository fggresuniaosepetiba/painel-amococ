import { z } from "zod";
import { ALL_PERMISSIONS, type Permission } from "@/constants/permissions";

const permissionEnum = z.enum(
  ALL_PERMISSIONS as unknown as [Permission, ...Permission[]]
);

export const userCreateSchema = z.object({
  name: z.string().min(3, "Informe o nome completo.").max(120),
  login: z
    .string()
    .min(3, "O login deve ter entre 3 e 30 caracteres.")
    .max(30)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use apenas letras, números, ponto, hífen ou underscore."
    ),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["SUPERADMIN", "ADMINISTRADOR", "COLABORADOR"]),
  status: z.enum(["ATIVO", "INATIVO"]),
  permissions: z.array(permissionEnum),
  initialPassword: z
    .string()
    .min(4, "A senha deve ter pelo menos 4 caracteres.")
    .max(72),
});

export const userEditSchema = userCreateSchema.omit({ initialPassword: true });

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;
export type UserEditFormValues = z.infer<typeof userEditSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(4, "A senha deve ter pelo menos 4 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
