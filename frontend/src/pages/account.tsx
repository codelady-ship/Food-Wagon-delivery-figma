import { useEffect, useState } from "react";
import { api, apiMode } from "@/lib/api.js";
import { clearAuth, setAuth } from "@/lib/store.js";
import { AuthForms } from "@/components/site/auth-forms";
import { toast, useAsync, useAuth, type Auth } from "@/lib/hooks";
import { formatDate, money } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { mountPage } from "@/components/site/shell";
import { ErrorBox, RestaurantCard, Skeleton, type Restaurant } from "@/components/site/cards";

type Order = { reference: string; statusLabel: string; total: number; createdAt: string; items: { qty: number; name: string }[] };

function Dashboard({ auth }: { auth: NonNullable<Auth> }) {
  const orders = useAsync(() => api("/me/orders") as Promise<Order[]>, []);
  const favs = useAsync(() => api("/me/favourites") as Promise<Restaurant[]>, [auth.user.favourites?.join(",")]);
  useEffect(() => {
    // refresh the stored profile (favourites may have changed on another device)
    api("/auth/me").then((user: NonNullable<Auth>["user"]) => setAuth({ ...auth, user }), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-primary-strong">My account</p>
          <h1 className="display mt-3 text-[clamp(2.6rem,7vw,5rem)]">Hi, {auth.user.name.split(" ")[0]}.</h1>
          <p className="mt-2 text-muted-foreground">{auth.user.email}</p>
        </div>
        <div className="flex gap-3">
          {auth.user.role === "admin" ? <LinkButton href="admin.html" variant="dark">Admin panel</LinkButton> : null}
          <Button
            variant="outline"
            onClick={() => {
              clearAuth();
              toast("Signed out");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>

      <section id="orders" aria-labelledby="orders-title" className="mt-12 scroll-mt-28">
        <h2 id="orders-title" className="text-3xl font-semibold">My orders</h2>
        {orders.error ? <ErrorBox error={orders.error} onRetry={orders.reload} /> : null}
        {orders.loading ? <Skeleton className="mt-4 h-40" /> : null}
        {orders.data && orders.data.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            No orders yet. <a href="restaurants.html" className="text-primary-strong underline">Find something tasty</a>.
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/5">
          {(orders.data || []).map((o) => (
            <li key={o.reference} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{o.reference} · {o.statusLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(o.createdAt)} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{money(o.total)}</span>
                <LinkButton href={`order.html?ref=${o.reference}`} size="sm" variant="outline">Track</LinkButton>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="favourites" aria-labelledby="fav-title" className="mt-12 scroll-mt-28">
        <h2 id="fav-title" className="text-3xl font-semibold">Favourite restaurants</h2>
        {favs.error ? <ErrorBox error={favs.error} onRetry={favs.reload} /> : null}
        {favs.data && favs.data.length === 0 ? <p className="mt-4 text-muted-foreground">Tap the heart on any restaurant to save it here.</p> : null}
        <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(favs.data || []).map((r) => (
            <li key={r.slug}>
              <RestaurantCard r={r} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AccountPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    apiMode().then(setMode);
  }, []);
  // a session from the other mode (live vs demo data) is not valid here
  const valid = auth && mode && auth.mode === mode ? auth : null;
  return (
    <div className="container-x py-10 md:py-16">
      {mode === null ? (
        <Skeleton className="h-80" />
      ) : valid ? (
        <Dashboard auth={valid} />
      ) : (
        <>
          <AuthForms />
          {mode === "demo" ? (
            <p className="mx-auto mt-6 max-w-md rounded-xl bg-muted p-4 text-sm">
              Demo mode: create an account with any name, email and an 8+ character password. Accounts, orders and favourites are saved in this browser only and no email is sent.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

mountPage("account", { root: <AccountPage /> });
