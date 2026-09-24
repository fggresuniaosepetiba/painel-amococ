import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-slate-200 bg-slate-100 text-slate-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        info: "border-azure-500/25 bg-azure-500/10 text-azure-600",
        brand: "border-brand-200 bg-brand-50 text-brand-700",
        gold: "border-gold-500/30 bg-gold-400/15 text-gold-600",
        dark: "border-ink-800 bg-ink-900 text-white",
        outline: "border-slate-300 bg-transparent text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
