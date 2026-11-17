import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api.js";
import { useAsync } from "@/lib/hooks";
import { cn, formatDate, money, qs } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { ErrorBox, Skeleton } from "@/components/site/cards";
import { recentOrders } from "@/lib/store.js";

type Order = {
  reference: string;
  status: string;
  statusLabel: string;
  steps: string[];
  mode: string;
  items: { dish: string; name: string; price: number; qty: number; restaurantName: string }[];
  promoCode: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  payment: string;
  createdAt: string;
};
const LABEL: Record<string, string> = { received: "Order received", preparing: "Preparing", on_the_way: "On the way", ready_for_pickup: "Ready for pickup", delivered: "Delivered", cancelled: "Cancelled" };

const recent = (): string[] => recentOrders();

function Tracker({ reference }: { reference: string }) {
  const { data: order, error, loading, reload } = useAsync(() => api(`/orders/${encodeURIComponent(reference)}`) as Promise<Order>, [reference]);
  useEffect(() => {
    if (!order || ["delivered", "cancelled"].includes(order.status)) return;
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [order, reload]);

  if (loading && !order) return <Skeleton className="h-96" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!order) return null;
  const current = order.steps.indexOf(order.status);
  const fresh = qs("new") === "1";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section aria-labelledby="status-title" className="rounded-2xl bg-coffee p-6 text-background md:p-8">
        {fresh ? (
          <div role="status" className="mb-6 rounded-xl bg-white/10 p-4 ring-1 ring-secondary/40">
            <p className="mono text-secondary">Thank you, your demo order is placed</p>
            <p className="mt-1 text-background/85">This is a portfolio demo: no payment was taken and no food will be delivered. The status below moves on its own so you can see how tracking works.</p>
          </div>
        ) : null}
        <p className="mono text-background/70">Order {order.reference}</p>
        <h2 id="status-title" className="display mt-2 text-[clamp(2.4rem,6vw,4.4rem)]" aria-live="polite">
          {order.statusLabel}
        </h2>
        <p className="mt-2 text-background/75">Placed {formatDate(order.createdAt)} · {order.mode === "pickup" ? "Pickup" : "Delivery"}. This page refreshes every 15 seconds.</p>
        {order.status === "cancelled" ? (
          <p className="mt-6 rounded-lg bg-white/10 p-4">This order was cancelled. Contact us if you have questions.</p>
        ) : (
          <ol className="mt-8 space-y-0">
            {order.steps.map((s, i) => (
              <li key={s} className="relative flex gap-4 pb-6 last:pb-0" aria-current={i === current ? "step" : undefined}>
                {i < order.steps.length - 1 ? <span className={cn("absolute top-8 left-[15px] h-[calc(100%-24px)] w-0.5", i < current ? "bg-secondary" : "bg-white/20")} aria-hidden="true" /> : null}
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", i < current ? "bg-secondary text-foreground" : i === current ? "bg-primary text-white ring-4 ring-primary/30" : "bg-white/15 text-background/70")}>{i < current ? "✓" : i + 1}</span>
                <span className={cn("pt-1", i <= current ? "font-semibold" : "text-background/60")}>
                  {LABEL[s]}
                  <span className="sr-only">{i < current ? " (done)" : i === current ? " (current step)" : " (next)"}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="items-title" className="rounded-2xl bg-muted p-6 md:p-8">
        <h2 id="items-title" className="text-2xl font-semibold">Items</h2>
        <ul className="mt-4 space-y-2 border-b border-border pb-4">
          {order.items.map((i) => (
            <li key={i.dish} className="flex justify-between gap-3">
              <span>
                {i.qty} × {i.name} <span className="text-sm text-muted-foreground">· {i.restaurantName}</span>
              </span>
              <span>{money(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {order.discount ? <div className="flex justify-between text-success"><dt>Promo {order.promoCode}</dt><dd>−{money(order.discount)}</dd></div> : null}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.deliveryFee ? money(order.deliveryFee) : "Free"}</dd></div>
          <div className="flex justify-between border-t border-border pt-3 text-xl font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Payment: {order.payment === "cash" ? "cash" : "demo card (not charged)"}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={reload}>Refresh status</Button>
          <LinkButton href="restaurants.html" variant="ghost">Order again</LinkButton>
        </div>
      </section>
    </div>
  );
}

function OrderPage() {
  const [ref, setRef] = useState(qs("ref").toUpperCase());
  const [input, setInput] = useState(ref);
  const [error, setError] = useState("");
  const list = recent();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    if (!/^FW-[0-9A-F]{6}$/.test(v)) {
      setError("Enter a reference like FW-1A2B3C");
      return;
    }
    setError("");
    history.replaceState(null, "", `?ref=${v}`);
    setRef(v);
  };
  return (
    <div className="container-x py-10 md:py-14">
      <p className="mono text-primary-strong">Order tracking</p>
      <h1 className="display mt-3 text-[clamp(2.6rem,7vw,5rem)]">Where is my food?</h1>
      <form onSubmit={submit} noValidate className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="ref" label="Order reference" error={error} className="flex-1">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="FW-1A2B3C" className="uppercase" />
        </Field>
        <Button type="submit" size="lg">Track</Button>
      </form>
      {list.length ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Your recent orders:</span>
          {list.map((r) => (
            <a key={r} href={`order.html?ref=${r}`} className="mono inline-flex min-h-11 items-center rounded-full bg-muted px-3 text-[0.75rem] no-underline hover:bg-secondary/30">{r}</a>
          ))}
        </p>
      ) : null}
      <div className="mt-10">{ref ? <Tracker key={ref} reference={ref} /> : <p className="text-muted-foreground">You find the reference on the confirmation screen and in My orders.</p>}</div>
    </div>
  );
}

mountPage("order", { root: <OrderPage /> });
