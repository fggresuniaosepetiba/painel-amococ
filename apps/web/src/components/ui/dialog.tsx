import { forwardRef, type HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg" | "xl";
  }
>(({ className, children, size = "md", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in-fast" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-popover outline-none data-[state=open]:animate-scale-in",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-lg",
        size === "lg" && "max-w-2xl",
        size === "xl" && "max-w-4xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-slate-100 px-6 py-5 pr-12",
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-slate-900", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm text-slate-500", className)}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
  );
}

/**
 * Formulário dentro do modal: mantém a cadeia flex do DialogContent
 * (`flex-col` + `max-h-[90vh]`). Sem este wrapper, um `<form>` plano quebra o
 * `flex-1` do DialogBody, a rolagem interna nunca ativa e o DialogFooter
 * (Salvar) é empurrado para fora da tela em viewports baixos.
 */
export function DialogForm({
  className,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("flex min-h-0 flex-1 flex-col", className)} {...props} />
  );
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
