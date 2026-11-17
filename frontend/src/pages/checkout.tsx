import { useState, type FormEvent } from "react";
import { api } from "@/lib/api.js";
import { clearCart, rememberOrder, setCartField } from "@/lib/store.js";
import { useAuth } from "@/lib/hooks";
import { cn, errorMessage, fieldErrors, money } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { Totals, usePricing } from "@/components/site/summary";

function CheckoutPage() {
  const auth = useAuth();
  const { cart, price, promo, promoError } = usePricing();
  const [form, setForm] = useState({ name: auth?.user.name || "", phone: "", email: auth?.user.email || "", address: "", note: "", payment: "card_demo" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!cart.items.length)
    return (
      <div className="container-x py-20 text-center">
        <h1 className="display text-[clamp(2.6rem,7vw,5rem)]">Nothing to check out.</h1>
        <LinkButton href="restaurants.html" size="lg" className="mt-8">
          Browse restaurants
        </LinkButton>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const order = await api("/orders", {
        method: "POST",
        body: {
          items: cart.items.map((i: { dish: string; qty: number }) => ({ dish: i.dish, qty: i.qty })),
          mode: cart.mode,
          promoCode: promo ? promo.code : "",
          ...form,
        },
      });
      rememberOrder(order.reference);
      clearCart();
      window.location.href = `order.html?ref=${order.reference}&new=1`;
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Please check the highlighted fields." : errorMessage(err));
      const first = Object.keys(fe)[0];
      if (first) document.getElementById(`co-${first}`)?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="mono text-muted-foreground">
        <a href="cart.html" className="inline-flex min-h-11 items-center hover:text-foreground">Cart</a> / <span aria-current="page">Checkout</span>
      </nav>
      <h1 className="display mt-3 text-[clamp(2.6rem,7vw,5rem)]">Checkout</h1>
      <form onSubmit={submit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-2xl font-semibold">How do you want it?</legend>
            <div className="flex gap-2" role="group" aria-label="Order type">
              {(["delivery", "pickup"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={cart.mode === m} onClick={() => setCartField("mode", m)} className={cn("mono min-h-12 flex-1 rounded-lg border text-[0.75rem]", cart.mode === m ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
                  {m === "delivery" ? "Delivery" : "Pickup"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-2xl font-semibold">Your details</legend>
            <Field id="co-name" label="Full name" error={errors.name}>
              <Input autoComplete="name" required value={form.name} onChange={set("name")} />
            </Field>
            <Field id="co-phone" label="Phone" error={errors.phone} hint="We call only if the courier cannot find you.">
              <Input type="tel" autoComplete="tel" required placeholder="+994 50 123 45 67" value={form.phone} onChange={set("phone")} />
            </Field>
            <Field id="co-email" label="Email (optional)" error={errors.email} className="sm:col-span-2">
              <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} />
            </Field>
            {cart.mode === "delivery" ? (
              <Field id="co-address" label="Delivery address" error={errors.address} className="sm:col-span-2">
                <Input autoComplete="street-address" required placeholder="Street, building, flat, Baku" value={form.address} onChange={set("address")} />
              </Field>
            ) : (
              <p className="rounded-xl bg-muted p-4 text-sm sm:col-span-2">Pickup: collect your order at the restaurant counter. The address is on the restaurant page.</p>
            )}
            <Field id="co-note" label="Note for the kitchen or courier (optional)" error={errors.note} className="sm:col-span-2">
              <Textarea maxLength={300} value={form.note} onChange={set("note")} placeholder="Ring twice, no onions..." />
            </Field>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-2xl font-semibold">Payment</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["card_demo", "Demo card", "Nothing is charged and no card details are collected."],
                ["cash", cart.mode === "pickup" ? "Pay at pickup" : "Cash on delivery", "Pay the courier or the counter."],
              ].map(([value, label, hint]) => (
                <label key={value} className={cn("flex min-h-16 cursor-pointer gap-3 rounded-xl border p-4", form.payment === value ? "border-primary bg-primary/5" : "border-border bg-card")}>
                  <input type="radio" name="payment" value={value} checked={form.payment === value} onChange={set("payment")} className="mt-1 size-5 accent-[#F17228]" />
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="text-sm text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside aria-label="Order summary" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-muted p-6">
            <h2 className="text-2xl font-semibold">Your order</h2>
            <ul className="mt-4 space-y-2 border-b border-border pb-4 text-sm">
              {cart.items.map((i: { dish: string; name: string; qty: number; price: number }) => (
                <li key={i.dish} className="flex justify-between gap-3">
                  <span>
                    {i.qty} × {i.name}
                  </span>
                  <span>{money(i.qty * i.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Totals price={price} promo={promo} mode={cart.mode} />
            </div>
            {promoError || errors.promoCode ? <p className="mt-3 text-sm text-danger">{errors.promoCode || promoError} <a href="cart.html" className="underline">Change code</a></p> : null}
            {formError ? (
              <p role="alert" className="mt-4 rounded-lg bg-[#fdf0ee] p-3 text-sm font-semibold text-danger">
                {formError}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
              {busy ? "Placing order..." : `Place order · ${money(price.total)}`}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Demo project: your order is stored but nothing is cooked, delivered or charged.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

mountPage("cart", { root: <CheckoutPage /> });
