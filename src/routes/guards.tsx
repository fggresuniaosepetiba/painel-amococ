import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Permission } from "@/constants/permissions";
import { useAuth } from "@/hooks/AuthProvider";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/** Exige autenticação; redireciona para /login caso contrário. */
export function RequireAuth() {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="flex flex-col items-center gap-4">
          <span className="h-12 w-12 animate-pulse rounded-full gradient-brand" />
          <p className="text-sm font-medium text-slate-500">Carregando sistema…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Exige uma permissão específica (camada centralizada de autorização). */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) {
    return (
      <div className="mx-auto mt-12 max-w-md animate-fade-in">
        <div className="surface-card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Acesso restrito
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Você não possui permissão para acessar esta área. Se necessário,
              procure o administrador do sistema.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/dashboard">Voltar ao dashboard</a>
          </Button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
