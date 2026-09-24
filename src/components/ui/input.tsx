import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus-ring",
        "hover:border-slate-400",
        invalid &&
          "border-red-400 bg-red-50/40 hover:border-red-400 focus-visible:ring-red-500/30",
        props.readOnly &&
          "cursor-not-allowed bg-slate-50 text-slate-600 hover:border-slate-300",
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
);
Input.displayName = "Input";
