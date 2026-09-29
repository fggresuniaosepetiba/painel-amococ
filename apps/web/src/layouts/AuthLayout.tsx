import type { ReactNode } from "react";
import { APP_FULL_NAME, APP_NAME, APP_SUBTITLE, LOGO_PATH } from "@/constants";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Painel institucional */}
      <div className="sidebar-surface relative hidden flex-1 flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="relative z-10 flex items-center gap-4">
          <span className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-brand-500/50">
            <img
              src={LOGO_PATH}
              alt="Logo AMOCOC"
              className="h-full w-full object-cover"
            />
          </span>
          <div>
            <p className="text-xl font-extrabold tracking-[0.22em] text-white">
              {APP_NAME}
            </p>
            <p className="text-xs text-slate-400">{APP_SUBTITLE}</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-6 h-1 w-16 rounded-full gradient-brand" />
          <h1 className="text-3xl font-bold leading-tight text-white">
            Gestão administrativa
            <br />
            <span className="text-gradient-brand">com identidade e segurança.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {APP_FULL_NAME}. Controle de associados, matrículas, carteirinhas,
            usuários e auditoria em um só lugar.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-2xs uppercase tracking-widest text-slate-500">
          <span>Desde 1981</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span>Sistema local</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span>v1.0</span>
        </div>

        {/* brilhos discretos */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      </div>

      {/* Área do formulário */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-10 sm:px-10">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Cabeçalho mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-brand-500/40">
              <img src={LOGO_PATH} alt="Logo AMOCOC" className="h-full w-full object-cover" />
            </span>
            <div>
              <p className="text-base font-extrabold tracking-[0.18em] text-slate-900">
                {APP_NAME}
              </p>
              <p className="text-2xs text-slate-500">{APP_SUBTITLE}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
