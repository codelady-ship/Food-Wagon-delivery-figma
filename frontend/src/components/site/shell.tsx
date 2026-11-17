import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { api } from "@/lib/api.js";
import { cartCount } from "@/lib/store.js";
import { toast, useApiMode, useAuth, useCart } from "@/lib/hooks";
import { cn, errorMessage, fieldErrors } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

const NAV = [
  { href: "restaurants.html", label: "Restaurants", key: "restaurants" },
  { href: "restaurants.html?deals=1", label: "Deals", key: "deals" },
  { href: "index.html#how", label: "How it works", key: "how" },
  { href: "order.html", label: "Track order", key: "order" },
  { href: "contact.html", label: "Contact", key: "contact" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="index.html" className={cn("inline-flex items-center gap-2.5 no-underline", light ? "text-background" : "text-foreground")} aria-label="Food Wagon home">
      <svg viewBox="0 0 40 40" className="size-9" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="#F17228" />
        <path d="M9 24h22l-2.2 6.2a2 2 0 0 1-1.9 1.3H13.1a2 2 0 0 1-1.9-1.3zM12 22a8 8 0 0 1 16 0z" fill="#FFB30E" />
        <circle cx="20" cy="11" r="2" fill="#FEFAF1" />
      </svg>
      <span className="font-display text-[1.45rem] font-semibold tracking-[-0.04em]">
        food<span className="text-primary">wagon</span>
      </span>
    </a>
  );
}

function Header({ current }: { current: string }) {
  const cart = useCart();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const count = cart.items.reduce((n: number, i: { qty: number }) => n + i.qty, 0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (n: (typeof NAV)[number], mobile = false) => (
    <a
      key={n.key}
      href={n.href}
      aria-current={current === n.key ? "page" : undefined}
      onClick={() => setOpen(false)}
      className={cn(
        "no-underline transition-colors hover:text-primary-strong aria-[current=page]:text-primary-strong",
        mobile ? "block border-b border-border py-4 font-display text-2xl tracking-tight" : "mono inline-flex min-h-11 items-center px-1 text-[0.7rem]"
      )}
    >
      {n.label}
    </a>
  );

  return (
    <header className="border-b border-foreground/5 bg-background/90 backdrop-blur-md">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-5 lg:flex">
          {NAV.map((n) => link(n))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="account.html" className="mono hidden min-h-11 items-center gap-2 rounded-lg px-3 text-[0.7rem] no-underline hover:bg-foreground/5 sm:inline-flex" aria-current={current === "account" ? "page" : undefined}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            {auth ? auth.user.name.split(" ")[0] : "Sign in"}
          </a>
          <a href="cart.html" className="relative inline-flex size-11 items-center justify-center rounded-lg bg-foreground text-background no-underline hover:bg-black" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9zM9 7a3 3 0 0 1 6 0" />
            </svg>
            {count > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold text-white" aria-hidden="true">
                {count}
              </span>
            ) : null}
          </a>
          <button
            ref={btnRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-foreground/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      <div id="mobile-nav" hidden={!open} className="border-t border-border bg-background lg:hidden">
        <nav aria-label="Mobile" className="container-x pb-6">
          {NAV.map((n) => link(n, true))}
          <a href="account.html" className="block py-4 font-display text-2xl tracking-tight no-underline" onClick={() => setOpen(false)}>
            {auth ? `My account (${auth.user.name.split(" ")[0]})` : "Sign in / Register"}
          </a>
        </nav>
      </div>
    </header>
  );
}

function DemoBanner() {
  const mode = useApiMode();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem("fw-demo-note") === "hidden";
    } catch {
      return false;
    }
  });
  if (mode !== "demo" || hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      sessionStorage.setItem("fw-demo-note", "hidden");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="fixed right-4 bottom-4 z-[55] flex max-w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-xl bg-coffee px-4 py-3 text-[0.8rem] text-background/90 shadow-2xl" role="note">
      <p>
        <span className="mono mr-1 text-secondary">Demo mode.</span> The live API is offline or not configured, so the site runs on built-in sample data. Orders, accounts and reviews stay in this browser.
      </p>
      <button type="button" onClick={close} className="-m-1 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-white/10" aria-label="Hide demo mode note">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}

export function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const id = `nl-${tone}`;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api("/newsletter", { method: "POST", body: { email } });
      setDone(res.message);
      setEmail("");
    } catch (err) {
      setError(fieldErrors(err).email || errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        Weekly deals in your inbox
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
          className={cn("min-h-12 flex-1 rounded-lg border px-4 text-base", tone === "dark" ? "border-white/20 bg-white/5 text-background placeholder:text-background/50" : "border-border bg-card")}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Subscribe"}
        </Button>
      </div>
      <p id={`${id}-msg`} role="status" className={cn("mt-2 min-h-5 text-sm", error ? "text-[#ffb4a8]" : "")}>
        {error || done}
      </p>
    </form>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="mono mb-4 text-secondary">{title}</h2>
      <ul className="space-y-0.5">
        {links.map(([href, label]) => (
          <li key={href + label}>
            <a href={href} className="inline-flex min-h-11 items-center text-background/80 no-underline hover:text-white">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="bg-foreground text-background">
      <div className="container-x grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo light />
          <p className="max-w-sm text-background/75">
            Food Wagon is a demo food delivery service for Baku: browse local restaurants, order in a few taps and follow your order live.
          </p>
          <NewsletterForm />
        </div>
        {col("Explore", [
          ["restaurants.html", "All restaurants"],
          ["restaurants.html?deals=1", "Deals"],
          ["restaurants.html?openNow=true", "Open now"],
          ["index.html#faq", "FAQ"],
        ])}
        {col("Account", [
          ["account.html", "Sign in / Register"],
          ["account.html#orders", "My orders"],
          ["account.html#favourites", "Favourites"],
          ["order.html", "Track an order"],
          ["admin.html", "Admin panel"],
        ])}
        {col("Company", [
          ["contact.html", "Contact us"],
          ["contact.html#partner", "Become a partner"],
          ["llms.txt", "llms.txt"],
          ["https://github.com/codelady-ship/Food-Wagon-delivery-figma", "Source code (GitHub)"],
        ])}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-sm text-background/70 md:flex-row md:items-center md:justify-between">
          <p>
            <strong className="text-background">Portfolio / demo project.</strong> No real orders, payments or deliveries happen here. Restaurants, prices and reviews are sample data.
          </p>
          <p>
            © {year} Food Wagon demo by{" "}
            <a href="https://github.com/codelady-ship" className="text-background underline-offset-4 hover:underline">
              codelady-ship
            </a>{" "}
            ·{" "}
            <a href="https://github.com/codelady-ship/Food-Wagon-delivery-figma/blob/main/docs/CREDITS.md" className="text-background underline-offset-4 hover:underline">
              Credits
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; tone: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { id, message, tone }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3600);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <p key={t.id} className={cn("pointer-events-auto max-w-md rounded-xl px-5 py-3 text-sm font-semibold shadow-xl", t.tone === "error" ? "bg-danger text-white" : "bg-foreground text-background")}>
          {t.message}
        </p>
      ))}
    </div>
  );
}

/** Mounts header, footer, toasts, then the page's own islands. */
export function mountPage(current: string, islands: Record<string, ReactNode>) {
  document.documentElement.classList.add("js");
  const mountTo = (id: string, node: ReactNode) => {
    const el = document.getElementById(id);
    if (el) createRoot(el).render(node);
  };
  mountTo("site-header", <Header current={current} />);
  mountTo("site-footer", (
    <>
      <Footer />
      <Toaster />
      <DemoBanner />
    </>
  ));
  Object.entries(islands).forEach(([id, node]) => mountTo(id, node));
}

export { cartCount, toast };
