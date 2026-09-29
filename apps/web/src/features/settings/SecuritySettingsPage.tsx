import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, LogOut, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldLabel } from "@/components/ui/label";
import { Alert, Separator } from "@/components/ui/misc";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/schemas/auth";
import { authService, settingsService } from "@/services";
import { formatDateTime } from "@/utils/format";
import { RoleBadge } from "@/components/shared/badges";
import type { AppSettings } from "@amococ/shared";
import { SESSION_DURATION_DAYS } from "@/constants";

export function SecuritySettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await settingsService.get();
        if (!cancelled) setSettings(loaded);
      } catch {
        // Mantém indefinido; a troca de senha informa o erro.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    try {
      await authService.changeOwnPassword(
        user,
        values.currentPassword,
        values.newPassword
      );
      await settingsService.updateSecurity({
        lastPasswordChangeAt: new Date().toISOString(),
      });
      await refreshUser();
      try {
        setSettings(await settingsService.get());
      } catch {
        // Mantém o estado atual.
      }
      reset();
      toast.success(
        "Senha alterada com sucesso",
        "Use a nova senha no próximo acesso."
      );
    } catch (err) {
      if (err instanceof Error && err.message === "A senha atual está incorreta.") {
        toast.error("Senha atual incorreta", "Verifique e tente novamente.");
      } else {
        toast.error("Não foi possível alterar a senha", "Tente novamente.");
      }
    }
  });

  if (!user) return null;

  const lastChange =
    settings?.security.lastPasswordChangeAt ?? user.updatedAt;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-500" />
              Alterar minha senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <FieldLabel required>Senha atual</FieldLabel>
              <div className="relative">
                <Input
                  type={show.current ? "text" : "password"}
                  autoComplete="current-password"
                  invalid={Boolean(errors.currentPassword)}
                  {...register("currentPassword")}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                  aria-label="Mostrar senha atual"
                >
                  {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={errors.currentPassword?.message} />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel required>Nova senha</FieldLabel>
                <div className="relative">
                  <Input
                    type={show.next ? "text" : "password"}
                    autoComplete="new-password"
                    invalid={Boolean(errors.newPassword)}
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
                    aria-label="Mostrar nova senha"
                  >
                    {show.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError message={errors.newPassword?.message} />
              </div>
              <div>
                <FieldLabel required>Confirmar nova senha</FieldLabel>
                <div className="relative">
                  <Input
                    type={show.confirm ? "text" : "password"}
                    autoComplete="new-password"
                    invalid={Boolean(errors.confirmPassword)}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                    aria-label="Confirmar mostrar senha"
                  >
                    {show.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError message={errors.confirmPassword?.message} />
              </div>
            </div>

            <Alert variant="info" title="Boas práticas">
              Use uma senha com pelo menos 8 caracteres, combinando letras,
              números e símbolos. A nova senha entra em vigor imediatamente.
            </Alert>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={isSubmitting}>
              {!isSubmitting && <Save className="h-4 w-4" />}
              {isSubmitting ? "Salvando..." : "Alterar senha"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Sessão atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Usuário" value={`${user.name} (${user.login})`} />
          <Separator />
          <Row label="Perfil" value={<RoleBadge role={user.role} />} />
          <Separator />
          <Row label="Status" value={user.status === "ATIVO" ? "Ativo" : "Inativo"} />
          <Separator />
          <Row label="Último acesso" value={formatDateTime(user.lastLoginAt)} />
          <Separator />
          <Row label="Última alteração de senha" value={formatDateTime(lastChange)} />
          <Separator />
          <Row label="Duração da sessão" value={`${SESSION_DURATION_DAYS} dias`} />

          <div className="pt-3">
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Encerrar sessão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
