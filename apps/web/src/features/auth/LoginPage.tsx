import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, ShieldAlert, User2 } from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/label";
import { AuthError, authService } from "@/services";
import {
  APP_FULL_NAME,
  APP_NAME,
  APP_SUBTITLE,
  IDLE_TIMEOUT_MINUTES,
} from "@/constants";

export function LoginPage() {
  const { user, booting, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleNotice, setIdleNotice] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    login?: string;
    password?: string;
  }>({});

  // Exibe (uma única vez) o motivo de um logout automático por inatividade.
  useEffect(() => {
    if (authService.consumeSessionNotice() === "IDLE_TIMEOUT") {
      setIdleNotice(true);
    }
  }, []);

  if (!booting && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const errors: { login?: string; password?: string } = {};
    if (!loginName.trim()) errors.login = "Informe o usuário.";
    if (!password) errors.password = "Informe a senha.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      await login(loginName.trim(), password);
      toast.success("Bem-vindo!", "Acesso autorizado ao painel.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError(
          "Não foi possível entrar agora. Tente novamente em instantes."
        );
      }
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8 hidden lg:block">
        <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-brand-600">
          {APP_NAME} · {APP_SUBTITLE}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Acesse o painel
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Entre com as suas credenciais para continuar.
        </p>
      </div>

      {idleNotice && (
        <div
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 animate-fade-in-fast"
          role="alert"
          data-testid="idle-logout-notice"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong className="font-semibold">
              Sessão encerrada por inatividade.
            </strong>{" "}
            Por segurança e conformidade com a LGPD, o sistema encerra a
            sessão automaticamente após {IDLE_TIMEOUT_MINUTES} minutos sem
            atividade — e também quando a aba é fechada. Entre novamente para
            continuar.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700 animate-fade-in-fast"
            role="alert"
          >
            {error}
          </div>
        )}

        <div>
          <FieldLabel required>Usuário</FieldLabel>
          <div className="relative">
            <User2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="login"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder="Digite seu usuário"
              className="pl-10"
              autoComplete="username"
              autoFocus
              invalid={Boolean(fieldErrors.login)}
              disabled={loading}
            />
          </div>
          {fieldErrors.login && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {fieldErrors.login}
            </p>
          )}
        </div>

        <div>
          <FieldLabel required>Senha</FieldLabel>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 pr-11"
              autoComplete="current-password"
              invalid={Boolean(fieldErrors.password)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
        >
          {!loading && <LogIn className="h-4 w-4" />}
          {loading ? "Entrando..." : "ENTRAR"}
        </Button>

        <p className="pt-2 text-center text-2xs leading-relaxed text-slate-400">
          {APP_FULL_NAME}
          <br />
          Sistema de uso restrito à diretoria.
        </p>
      </form>
    </AuthLayout>
  );
}
