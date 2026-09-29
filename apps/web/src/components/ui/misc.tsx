import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { Check, Minus } from "lucide-react";
import { cn } from "@/utils/cn";

/* Switch */
export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-ring data-[state=checked]:gradient-brand data-[state=unchecked]:bg-slate-300",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

/* Separator */
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
}: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-slate-200",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}

/* Checkbox estilizado */
export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
}

export function Checkbox({ className, label, description, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-1.5 transition hover:border-slate-200 hover:bg-slate-50",
        className
      )}
    >
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-slate-300 bg-white shadow-sm transition group-hover:border-slate-400 group-has-[:checked]:border-brand-600 group-has-[:checked]:gradient-brand">
        <input
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <Check className="h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-[13px] font-medium text-slate-800">
              {label}
            </span>
          )}
          {description && (
            <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}

/* Checkbox indeterminado (permissões "todos") */
export function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition">
        <input
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[4px] transition",
            indeterminate
              ? "gradient-brand"
              : checked
                ? "gradient-brand"
                : "bg-transparent"
          )}
        />
        {indeterminate ? (
          <Minus className="pointer-events-none relative h-3 w-3 text-white" />
        ) : (
          <Check
            className={cn(
              "pointer-events-none relative h-3 w-3 text-white transition",
              checked ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </span>
      <span className="text-[13px] font-medium text-slate-800">{label}</span>
    </label>
  );
}

/* Avatar */
export function AvatarInitials({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold tracking-wide text-white",
        className
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* Toast-free alert inline */
export function Alert({
  variant = "info",
  title,
  children,
  className,
  icon,
  action,
}: {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    info: "border-azure-500/25 bg-azure-500/10 text-azure-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5",
        styles[variant],
        className
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13px] font-semibold">{title}</p>}
        {children && (
          <div className={cn("text-[13px] leading-relaxed opacity-90", title && "mt-0.5")}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* Botão de página (atalho para ações principais de listas) */
export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-ring",
        className
      )}
      {...props}
    />
  );
}

/* Spinner */
export function Spinner({ className }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600",
        className
      )}
      role="status"
      aria-label="Carregando"
    />
  );
}

/* Skeleton */
export function Skeleton({ className }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} />;
}
