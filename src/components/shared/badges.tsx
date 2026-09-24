import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

export function StatusBadge({
  status,
  className,
}: {
  status: "ATIVO" | "INATIVO";
  className?: string;
}) {
  const active = status === "ATIVO";
  return (
    <Badge
      variant={active ? "success" : "default"}
      className={cn(
        "gap-1.5 px-2.5",
        !active && "bg-slate-200/70 text-slate-500",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "SuperAdmin",
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
};

export function RoleBadge({ role }: { role: string }) {
  if (role === "SUPERADMIN") {
    return (
      <Badge variant="dark" className="gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
        {ROLE_LABELS[role]}
      </Badge>
    );
  }
  return (
    <Badge variant="info">{ROLE_LABELS[role] ?? role}</Badge>
  );
}

const ACTION_LABELS: Record<string, { label: string; variant: string }> = {
  LOGIN: { label: "Login", variant: "info" },
  LOGOUT: { label: "Logout", variant: "default" },
  MEMBER_CREATED: { label: "Associado criado", variant: "success" },
  MEMBER_UPDATED: { label: "Associado editado", variant: "info" },
  MEMBER_INACTIVATED: { label: "Associado inativado", variant: "warning" },
  MEMBER_REACTIVATED: { label: "Associado reativado", variant: "success" },
  MEMBER_DELETED: { label: "Associado excluído", variant: "danger" },
  CARD_GENERATED: { label: "Carteirinha gerada", variant: "brand" },
  CARD_DOWNLOADED: { label: "Carteirinha baixada", variant: "brand" },
  USER_CREATED: { label: "Usuário criado", variant: "success" },
  USER_UPDATED: { label: "Usuário editado", variant: "info" },
  USER_INACTIVATED: { label: "Usuário inativado", variant: "warning" },
  USER_REACTIVATED: { label: "Usuário reativado", variant: "success" },
  PERMISSION_CHANGED: { label: "Permissões alteradas", variant: "gold" },
  SETTINGS_UPDATED: { label: "Configurações alteradas", variant: "info" },
  SIGNATURE_UPDATED: { label: "Assinatura atualizada", variant: "gold" },
  PASSWORD_CHANGED: { label: "Senha alterada", variant: "danger" },
  SYSTEM_FACTORY_RESET: { label: "Base restaurada", variant: "warning" },
};

export function ActionBadge({ action }: { action: string }) {
  const config = ACTION_LABELS[action] ?? {
    label: action,
    variant: "default",
  };
  return (
    <Badge
      variant={
        config.variant as
          | "default"
          | "success"
          | "danger"
          | "warning"
          | "info"
          | "brand"
          | "gold"
          | "dark"
          | "outline"
      }
    >
      {config.label}
    </Badge>
  );
}
