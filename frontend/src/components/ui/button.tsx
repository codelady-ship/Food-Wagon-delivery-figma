import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-strong shadow-[0_10px_24px_-10px_rgba(241,114,40,.7)]",
  dark: "bg-foreground text-background hover:bg-black",
  outline: "border border-foreground/20 bg-transparent hover:border-foreground",
  ghost: "bg-transparent hover:bg-foreground/5",
  soft: "bg-muted text-foreground hover:bg-secondary/30",
  danger: "bg-danger text-white hover:brightness-110",
} as const;
const sizes = {
  sm: "min-h-11 px-4 text-[0.7rem]",
  md: "min-h-12 px-5 text-[0.75rem]",
  lg: "min-h-14 px-7 text-[0.8rem]",
  icon: "size-11 p-0",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-mono font-bold uppercase tracking-[0.1em] whitespace-nowrap no-underline",
    "transition-[background,color,border-color,transform,box-shadow] duration-300 ease-[var(--ease-expo)] active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    variants[variant],
    sizes[size],
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant, size, className, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...props} />
));
Button.displayName = "Button";

export function LinkButton({ variant, size, className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return <a className={buttonClass({ variant, size, className })} {...props} />;
}
