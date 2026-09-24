import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  className,
  description,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {children}
      </h2>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("animate-fade-in", className)}>{children}</div>;
}
