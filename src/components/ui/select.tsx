import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * Select nativo com aparência consistente do design system.
 * (Nativo = melhor acessibilidade e comportamento em todos os dispositivos.)
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3.5 pr-9 text-sm text-slate-900 shadow-sm transition focus-ring",
          "hover:border-slate-400",
          invalid && "border-red-400 bg-red-50/40 hover:border-red-400",
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
);
Select.displayName = "Select";
