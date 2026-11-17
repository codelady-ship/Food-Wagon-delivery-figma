import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui class helper */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
export const priceLevel = (n: number) => "$".repeat(Math.max(1, Math.min(3, n || 1)));

/** Seed images are site-relative (images/x.webp); uploads are absolute URLs or data: URLs. */
export const imgSrc = (src?: string) => (!src ? "images/hero-bowl.webp" : src);

export const qs = (key: string) => new URLSearchParams(window.location.search).get(key) || "";

export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const details = (err as { details?: { field: string; message: string }[] })?.details || [];
  details.forEach((d) => {
    if (d.field && !out[d.field]) out[d.field] = d.message;
  });
  return out;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");

export function formatDate(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
