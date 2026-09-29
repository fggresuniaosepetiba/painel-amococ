import { NavLink, Outlet } from "react-router-dom";
import {
  FileText,
  CreditCard,
  KeyRound,
  Monitor,
  PenLine,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { cn } from "@/utils/cn";

const SECTIONS = [
  { to: "/configuracoes/associacao", label: "Associação", icon: FileText },
  { to: "/configuracoes/carteirinha", label: "Carteirinha", icon: CreditCard },
  { to: "/configuracoes/assinatura", label: "Assinatura", icon: PenLine },
  { to: "/configuracoes/seguranca", label: "Segurança", icon: KeyRound },
  { to: "/configuracoes/sistema", label: "Sistema", icon: Monitor },
];

export function SettingsLayout() {
  return (
    <PageContainer>
      <PageHeader
        title="Configurações"
        description="Ajustes da associação, carteirinha, assinatura e segurança."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px,1fr]">
        <nav className="lg:sticky lg:top-24 lg:h-fit">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((section) => (
              <li key={section.to} className="shrink-0">
                <NavLink
                  to={section.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-white text-slate-900 shadow-card ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                    )
                  }
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
}
