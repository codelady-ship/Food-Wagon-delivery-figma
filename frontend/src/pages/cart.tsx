import { useState, type FormEvent } from "react";
import { setCartField, setQty, clearCart } from "@/lib/store.js";
import { cn, imgSrc, money } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { Totals, usePricing } from "@/components/site/summary";

type Line = { dish: string; name: string; price: number; image: string; restaurant: string; restaurantName: string; qty: number };

function CartPage() {
  const { cart, price, promo, promoError } = usePricing();
  const [code, setCode] = useState(cart.promo || "");
  const items = cart.items as Line[];

  const applyPromo = (e: FormEvent) => {
    e.preventDefault();
    setCartField("promo", code.trim().toUpperCase());
  };

  if (!items.length)
    return (
      <div className="container-x py-20 text-center">
        <h1 className="display text-[clamp(2.6rem,7vw,5rem)]">Your cart is empty.</h1>
        <p className="mt-4 text-muted-foreground">Pick a restaurant and add a few dishes.</p>
        <LinkButton href="restaurants.html" size="lg" className="mt-8">
          Browse restaurants
        </LinkButton>
      </div>
    );

  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display text-[clamp(2.6rem,7vw,5rem)]">Your cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section aria-label="Cart items">
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/5">
            {items.map((i) => (
              <li key={i.dish} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <img src={imgSrc(i.image)} alt="" width={80} height={80} className="size-20 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.name}</p>
                  <a href={`restaurant.html?slug=${i.restaurant}`} className="text-sm text-primary-strong underline-offset-4 hover:underline">
                    {i.restaurantName}
                  </a>
                  <p className="text-sm text-muted-foreground">{money(i.price)} each</p>
                </div>
                <div className="flex items-center gap-1" role="group" aria-label={`Quantity of ${i.name}`}>
                  <Button variant="soft" size="icon" aria-label={`Remove one ${i.name}`} onClick={() => setQty(i.dish, i.qty - 1)}>
                    −
                  </Button>
                  <span className="w-8 text-center font-semibold" aria-live="polite">
                    {i.qty}
                  </span>
                  <Button variant="soft" size="icon" aria-label={`Add one more ${i.name}`} disabled={i.qty >= 20} onClick={() => setQty(i.dish, i.qty + 1)}>
                    +
                  </Button>
                </div>
                <p className="w-20 text-right font-semibold">{money(i.price * i.qty)}</p>
                <Button variant="ghost" size="icon" aria-label={`Remove ${i.name} from cart`} onClick={() => setQty(i.dish, 0)}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  </svg>
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <LinkButton href="restaurants.html" variant="outline">
              Add more dishes
            </LinkButton>
            <Button variant="ghost" onClick={() => clearCart()}>
              Empty cart
            </Button>
          </div>
        </section>

        <aside aria-label="Order summary" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-muted p-6">
            <h2 className="text-2xl font-semibold">Summary</h2>
            <div className="mt-4 flex gap-2" role="group" aria-label="Order type">
              {(["delivery", "pickup"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={cart.mode === m} onClick={() => setCartField("mode", m)} className={cn("mono min-h-11 flex-1 rounded-lg text-[0.7rem]", cart.mode === m ? "bg-foreground text-background" : "bg-card")}>
                  {m}
                </button>
              ))}
            </div>
            <form onSubmit={applyPromo} className="mt-5" noValidate>
              <label htmlFor="promo" className="mb-1.5 block text-sm font-semibold">
                Promo code
              </label>
              <div className="flex gap-2">
                <Input id="promo" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WELCOME10" aria-invalid={promoError ? true : undefined} aria-describedby="promo-msg" className="uppercase" />
                <Button type="submit" variant="dark">
                  Apply
                </Button>
              </div>
              <p id="promo-msg" role="status" className={cn("mt-2 min-h-5 text-sm", promoError ? "text-danger" : "text-success")}>
                {promoError || (promo ? `${promo.code}: ${promo.description}` : "")}
              </p>
              {cart.promo ? (
                <button
                  type="button"
                  className="min-h-11 text-sm underline"
                  onClick={() => {
                    setCode("");
                    setCartField("promo", "");
                  }}
                >
                  Remove code
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">Try WELCOME10, FREESHIP or BIG5.</p>
              )}
            </form>
            <div className="mt-5">
              <Totals price={price} promo={promo} mode={cart.mode} />
            </div>
            <LinkButton href="checkout.html" size="lg" className="mt-6 w-full">
              Go to checkout
            </LinkButton>
          </div>
        </aside>
      </div>
    </div>
  );
}

mountPage("cart", { root: <CartPage /> });
