// Types for catalog.mjs (used by the TypeScript front end).
export const CATEGORIES: string[];
export const CATEGORY_LABELS: Record<string, string>;
export const ORDER_STATUSES: string[];
export const STATUS_LABELS: Record<string, string>;
export const FREE_DELIVERY_FROM: number;
export const SORTS: string[];
export function round2(n: number): number;
export function bakuMinutes(now?: Date): number;
export function isOpenNow(r: { opensAt: string; closesAt: string }, now?: Date): boolean;
export function searchRestaurants<T>(restaurants: T[], dishes?: unknown[], query?: Record<string, unknown>, now?: Date): (T & { openNow: boolean })[];
export function filterDishes<T>(dishes: T[], query?: Record<string, unknown>): T[];
export type PromoLike = { type: "percent" | "fixed" | "free_delivery"; value: number; minSubtotal?: number; active?: boolean; expiresAt?: string | Date | null; maxUses?: number; uses?: number };
export function promoProblem(promo: PromoLike | null | undefined, subtotal: number, now?: Date): string | null;
export function priceOrder(input: {
  lines: { price: number; qty: number; restaurant: string }[];
  mode?: string;
  restaurants?: { slug: string; deliveryFee: number }[];
  promo?: PromoLike | null;
  now?: Date;
}): { subtotal: number; deliveryFee: number; discount: number; total: number; promoError: string | null };
export function statusSteps(mode: string): string[];
export function simulatedStatus(order: { mode: string; status: string; manualStatus?: boolean; createdAt: string | Date }, now?: Date): string;
export function slugify(s: string): string;
