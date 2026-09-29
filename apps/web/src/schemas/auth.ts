import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(1, "Informe o usuário."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(4, "A nova senha deve ter pelo menos 4 caracteres.")
      .max(72, "Senha muito longa."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da atual.",
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
