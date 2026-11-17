import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full min-h-12 rounded-lg border border-border bg-card px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/80 " +
  "transition-colors focus:border-primary focus:outline-none focus-visible:outline-3 focus-visible:outline-ring/60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, "min-h-28 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(control, "cursor-pointer pr-8", className)} {...props} />
));
Select.displayName = "Select";

/** Label + control + error message, wired with aria-describedby. */
export function Field({ id, label, error, hint, children, className }: { id: string; label: React.ReactNode; error?: string; hint?: string; children: React.ReactElement<Record<string, unknown>>; className?: string }) {
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {React.cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
