import { useEffect, useState } from "react";
import { api } from "@/lib/api.js";
import { priceOrder, FREE_DELIVERY_FROM } from "../../../../backend/shared/catalog.mjs";
import { useAsync, useCart } from "@/lib/hooks";
import { money } from "@/lib/utils";
import type { Restaurant } from "./cards";

export type Promo = { code: string; type: "percent" | "fixed" | "free_delivery"; value: number; minSubtotal: number; description: string };

/** Validates the saved promo code against the API whenever the cart changes. */
export function usePricing() {
  const cart = useCart();
  const { data: restaurants } = useAsync(() => api("/restaurants") as Promise<Restaurant[]>, []);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState("");
  const subtotal = cart.items.reduce((s: number, i: { price: number; qty: number }) => s + i.price * i.qty, 0);

  useEffect(() => {
    let alive = true;
    if (!cart.promo) {
      setPromo(null);
      setPromoError("");
      return;
    }
    api("/promos/validate", { method: "POST", body: { code: cart.promo, subtotal } }).then(
      (p: Promo) => alive && (setPromo(p), setPromoError("")),
      (err: Error) => alive && (setPromo(null), setPromoError(err.message))
    );
    return () => {
      alive = false;
    };
  }, [cart.promo, subtotal]);

  const price = priceOrder({ lines: cart.items, mode: cart.mode, restaurants: restaurants || [], promo });
  return { cart, price, promo, promoError, restaurants };
}

export function Totals({ price, promo, mode }: { price: ReturnType<typeof priceOrder>; promo: Promo | null; mode: string }) {
  const toFree = FREE_DELIVERY_FROM - price.subtotal;
  return (
    <dl className="space-y-2.5">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{money(price.subtotal)}</dd>
      </div>
      {price.discount ? (
        <div className="flex justify-between text-success">
          <dt>Promo {promo?.code}</dt>
          <dd>−{money(price.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt>{mode === "pickup" ? "Pickup" : "Delivery"}</dt>
        <dd>{price.deliveryFee ? money(price.deliveryFee) : "Free"}</dd>
      </div>
      {mode === "delivery" && toFree > 0 && price.deliveryFee > 0 ? <p className="text-sm text-muted-foreground">Add {money(toFree)} more for free delivery.</p> : null}
      <div className="flex justify-between border-t border-border pt-3 text-xl font-semibold">
        <dt>Total</dt>
        <dd>{money(price.total)}</dd>
      </div>
    </dl>
  );
}
