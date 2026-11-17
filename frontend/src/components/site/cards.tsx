import { useState } from "react";
import { api } from "@/lib/api.js";
import { addToCart, getAuth, setAuth } from "@/lib/store.js";
import { toast, useAuth } from "@/lib/hooks";
import { cn, errorMessage, imgSrc, money, priceLevel } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Restaurant = {
  slug: string;
  name: string;
  description?: string;
  cuisines: string[];
  priceLevel: number;
  rating: number;
  ratingCount: number;
  deliveryTime: number;
  deliveryFee: number;
  address?: string;
  image: string;
  alt?: string;
  discount?: number;
  fast?: boolean;
  opensAt: string;
  closesAt: string;
  openNow?: boolean;
};
export type Dish = {
  slug: string;
  name: string;
  description?: string;
  restaurant: string;
  restaurantName: string;
  price: number;
  cat: string;
  image: string;
  alt?: string;
  popular?: boolean;
  available?: boolean;
  likes?: number;
  chef?: string;
  ingredients?: string[];
  accent?: string;
  cutout?: string;
  headline?: string[];
  featured?: boolean;
};

export const LABELS: Record<string, string> = { italian: "Italian", burger: "Burgers", grill: "Grill", asian: "Asian", chicken: "Chicken", healthy: "Healthy", dessert: "Desserts", drinks: "Drinks" };

export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", size === "lg" ? "text-lg" : "text-sm")}>
      <svg viewBox="0 0 24 24" className={size === "lg" ? "size-5" : "size-4"} fill="#FFB30E" aria-hidden="true">
        <path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
      </svg>
      <span>
        {Number(value).toFixed(1)}
        <span className="sr-only"> out of 5</span>
      </span>
    </span>
  );
}

export function useFavourite(slug: string) {
  const auth = useAuth();
  const isFav = Boolean(auth?.user.favourites?.includes(slug));
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const current = getAuth();
    if (!current) {
      toast("Sign in to save favourites", "error");
      setTimeout(() => (window.location.href = `account.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`), 900);
      return;
    }
    setBusy(true);
    try {
      const res = await api(`/me/favourites/${slug}`, { method: isFav ? "DELETE" : "PUT" });
      setAuth({ ...current, user: { ...current.user, favourites: res.favourites } });
      toast(isFav ? "Removed from favourites" : "Saved to favourites");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return { isFav, toggle, busy };
}

export function FavButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const { isFav, toggle, busy } = useFavourite(slug);
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isFav}
      aria-label={isFav ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={cn("grid size-11 place-items-center rounded-full bg-card/95 shadow-md transition-transform hover:scale-105", className)}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill={isFav ? "#F17228" : "none"} stroke={isFav ? "#F17228" : "#212121"} strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    </button>
  );
}

export function RestaurantCard({ r }: { r: Restaurant }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[0_18px_40px_-28px_rgba(43,21,9,.45)] ring-1 ring-foreground/5 transition-transform duration-500 ease-[var(--ease-expo)] hover:-translate-y-1">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={imgSrc(r.image)} alt={r.alt || r.name} width={480} height={360} loading="lazy" className="size-full object-cover transition-transform duration-700 ease-[var(--ease-expo)] group-hover:scale-105" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {r.discount ? <span className="rounded-md bg-primary px-2.5 py-1 text-sm font-bold text-white">-{r.discount}%</span> : null}
          {r.fast ? <span className="rounded-md bg-secondary px-2.5 py-1 text-sm font-bold text-foreground">Fast</span> : null}
        </div>
        <FavButton slug={r.slug} name={r.name} className="absolute top-3 right-3 z-10" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">
            <a href={`restaurant.html?slug=${r.slug}`} className="no-underline after:absolute after:inset-0 after:content-['']">
              {r.name}
            </a>
          </h3>
          <Stars value={r.rating} />
        </div>
        <p className="text-sm text-muted-foreground">
          {r.cuisines.map((c) => LABELS[c] || c).join(" · ")} · <span aria-label={`Price level ${r.priceLevel} of 3`}>{priceLevel(r.priceLevel)}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm">
          <span>{r.deliveryTime} min</span>
          <span>{r.deliveryFee ? `${money(r.deliveryFee)} delivery` : "Free delivery"}</span>
          <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold", r.openNow ? "bg-[#e3f4e8] text-success" : "bg-[#fde7e4] text-danger")}>{r.openNow ? "Open now" : `Opens ${r.opensAt}`}</span>
        </div>
      </div>
    </article>
  );
}

export function addDish(d: Dish) {
  addToCart(d, 1);
  toast(`${d.name} added to your cart`);
}

export function DishCard({ d, showRestaurant = true }: { d: Dish; showRestaurant?: boolean }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-card ring-1 ring-foreground/5">
      <img src={imgSrc(d.image)} alt={d.alt || d.name} width={400} height={300} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-lg font-semibold tracking-tight">{d.name}</h3>
        {showRestaurant ? (
          <a href={`restaurant.html?slug=${d.restaurant}`} className="-my-2 inline-flex min-h-11 items-center self-start text-sm text-primary-strong underline-offset-4 hover:underline">
            {d.restaurantName}
          </a>
        ) : null}
        {d.description ? <p className="text-sm text-muted-foreground">{d.description}</p> : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="font-display text-xl font-semibold">{money(d.price)}</span>
          <Button size="sm" onClick={() => addDish(d)} aria-label={`Add ${d.name} to cart`}>
            Add
          </Button>
        </div>
      </div>
    </article>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-card)] bg-foreground/[0.06]", className)} aria-hidden="true" />;
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-[#fdf0ee] p-5">
      <p className="font-semibold text-danger">{error.message || "Could not load data."}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
