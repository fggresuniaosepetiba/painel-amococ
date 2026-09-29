import { useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronDown,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  UserSquare2,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useToast } from "@/hooks/ToastProvider";
import { APP_NAME, APP_SUBTITLE, LOGO_PATH } from "@/constants";
import type { Permission } from "@amococ/shared";
import { AvatarInitials } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/shared/badges";
import { cn } from "@/utils/cn";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
        end: true,
      },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/associados", label: "Associados", icon: Users, permission: "members.view" },
      {
        to: "/associados/novo",
        label: "Novo associado",
        icon: UserPlus,
        permission: "members.create",
      },
      {
        to: "/carteirinhas",
        label: "Carteirinhas",
        icon: CreditCard,
        permission: "cards.view",
      },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/usuarios", label: "Usuários", icon: UserSquare2, permission: "users.view" },
      {
        to: "/usuarios/permissoes",
        label: "Permissões",
        icon: ShieldCheck,
        permission: "users.permissions",
      },
      {
        to: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        permission: "settings.view",
        end: true,
      },
      { to: "/auditoria", label: "Auditoria", icon: History, permission: "audit.view" },
    ],
  },
];

const SETTINGS_SUBNAV = [
  { to: "/configuracoes/associacao", label: "Associação" },
  { to: "/configuracoes/carteirinha", label: "Carteirinha" },
  { to: "/configuracoes/assinatura", label: "Assinatura" },
  { to: "/configuracoes/seguranca", label: "Segurança" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "px-5 py-4" : "px-5 py-5")}>
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-500/40">
        <img
          src={LOGO_PATH}
          alt="Logo AMOCOC"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold tracking-[0.18em] text-white">
          {APP_NAME}
        </p>
        <p className="truncate text-2xs text-slate-400">{APP_SUBTITLE}</p>
      </div>
    </div>
  );
}

function SidebarNav() {
  const { hasPermission } = useAuth();
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.permission)),
      })).filter((group) => group.items.length > 0),
    [hasPermission]
  );

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
      {groups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-gold-500 transition-opacity",
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-colors",
                          isActive
                            ? "text-brand-400"
                            : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          {group.label === "Administração" && hasPermission("settings.view") && (
            <ul className="mt-1 space-y-0.5 border-l border-white/10 pl-4 ml-[15px]">
              {SETTINGS_SUBNAV.map((sub) => (
                <li key={sub.to}>
                  <NavLink
                    to={sub.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
                        isActive
                          ? "text-brand-300"
                          : "text-slate-500 hover:text-slate-300"
                      )
                    }
                  >
                    {sub.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="border-t border-white/10 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/5 focus-ring"
          >
            <AvatarInitials
              name={user.name}
              className="gradient-brand h-9 w-9 text-white"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">
                {user.name}
              </span>
              <span className="block truncate text-2xs text-slate-400">
                {user.role === "SUPERADMIN" ? "SuperAdmin" : user.role}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <div className="flex items-center gap-3 px-3 py-2">
            <AvatarInitials name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-900">
                {user.name}
              </p>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={onLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function HeaderUserMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition hover:border-slate-300 focus-ring"
        >
          <AvatarInitials name={user.name} className="h-7 w-7 text-[10px]" />
          <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-slate-700 sm:block">
            {user.name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-3 py-2">
          <AvatarInitials name={user.name} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-2xs text-slate-500">@{user.login}</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <RoleBadge role={user.role} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={onLogout}>
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ROUTE_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/dashboard$/, title: "Dashboard" },
  { match: /^\/associados\/novo$/, title: "Novo associado" },
  { match: /^\/associados\/[^/]+\/editar$/, title: "Editar associado" },
  { match: /^\/associados\/[^/]+$/, title: "Detalhes do associado" },
  { match: /^\/associados$/, title: "Associados" },
  { match: /^\/carteirinhas$/, title: "Carteirinhas emitidas" },
  { match: /^\/usuarios\/permissoes$/, title: "Permissões" },
  { match: /^\/usuarios$/, title: "Usuários" },
  { match: /^\/configuracoes\/associacao$/, title: "Associação" },
  { match: /^\/configuracoes\/carteirinha$/, title: "Carteirinha" },
  { match: /^\/configuracoes\/assinatura$/, title: "Assinatura" },
  { match: /^\/configuracoes\/seguranca$/, title: "Segurança" },
  { match: /^\/configuracoes\/sistema$/, title: "Sistema" },
  { match: /^\/configuracoes$/, title: "Configurações" },
  { match: /^\/auditoria$/, title: "Auditoria" },
];

function Breadcrumbs({ path }: { path: string }) {
  const entry = ROUTE_TITLES.find((r) => r.match.test(path));
  const title = entry?.title ?? "Painel AMOCOC";
  const parts = path.split("/").filter(Boolean);
  const section = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "";

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="hidden text-slate-400 sm:inline">Painel</span>
      {parts.length > 1 && (
        <>
          <span className="text-slate-300">/</span>
          <span className="truncate text-slate-400">{section}</span>
        </>
      )}
      <span className="text-slate-300">/</span>
      <span className="truncate font-semibold text-slate-800">{title}</span>
    </nav>
  );
}

export function AppLayout() {
  const { logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.info("Sessão encerrada", "Você saiu do painel com segurança.");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="sidebar-surface fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
        <Brand />
        <SidebarNav />
        <SidebarFooter onLogout={() => void handleLogout()} />
      </aside>

      {/* Sidebar — mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="sidebar-surface absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col animate-fade-in-fast shadow-popover">
            <button
              type="button"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Brand compact />
            <div onClick={() => setMobileOpen(false)}>
              <SidebarNav />
            </div>
            <SidebarFooter onLogout={() => void handleLogout()} />
          </aside>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs path={location.pathname} />
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-2xs font-medium text-slate-500 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistema local
            </span>
            <HeaderUserMenu onLogout={() => void handleLogout()} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200/70 px-6 py-4 text-center text-2xs text-slate-400">
          {APP_NAME} — {APP_SUBTITLE} · Dados armazenados localmente no navegador
        </footer>
      </div>
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
