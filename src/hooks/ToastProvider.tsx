import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-200",
    iconColor: "text-emerald-600",
  },
  error: {
    icon: AlertCircle,
    ring: "border-red-200",
    iconColor: "text-red-600",
  },
  info: { icon: Info, ring: "border-azure-500/30", iconColor: "text-azure-600" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, variant === "error" ? 6000 : 4000);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
    }),
    [push]
  );

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end"
      >
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-xl border bg-white p-4 shadow-popover",
                style.ring
              )}
              role="alert"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconColor)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
