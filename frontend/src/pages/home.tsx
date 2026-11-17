import { useState } from "react";
import { api } from "@/lib/api.js";
import { useAsync, useReveal } from "@/lib/hooks";
import { cn } from "@/lib/utils";

import { mountPage } from "@/components/site/shell";
import { Hero } from "@/components/site/hero";
import { OrbitMenu } from "@/components/site/orbit-menu";
import { DishCard, ErrorBox, LABELS, RestaurantCard, Skeleton, type Dish, type Restaurant } from "@/components/site/cards";

const CATS = ["all", "italian", "burger", "grill", "asian", "chicken", "healthy", "dessert", "drinks"];

function PopularDishes() {
  const [cat, setCat] = useState("all");
  const { data, error, loading, reload } = useAsync(() => api(`/dishes?popular=true${cat !== "all" ? `&cat=${cat}` : ""}`) as Promise<Dish[]>, [cat]);
  useReveal([data]);
  return (
    <div>
      <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Filter popular dishes by category">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={cn("mono min-h-11 shrink-0 rounded-full border px-4 text-[0.75rem] transition-colors", cat === c ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:border-foreground")}
          >
            {c === "all" ? "All" : LABELS[c]}
          </button>
        ))}
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite" aria-busy={loading}>
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-80" />
              </li>
            ))
          : (data || []).slice(0, 8).map((d) => (
              <li key={d.slug} className="rv">
                <DishCard d={d} />
              </li>
            ))}
      </ul>
      {!loading && data && data.length === 0 ? (
        <p className="text-muted-foreground">
          No popular dishes in this category yet. <a href={`restaurants.html?cuisine=${cat}`} className="text-primary-strong underline">Browse restaurants</a>
        </p>
      ) : null}
    </div>
  );
}

function FeaturedRestaurants() {
  const { data, error, loading, reload } = useAsync(() => api("/restaurants?sort=rating") as Promise<Restaurant[]>, []);
  useReveal([data]);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-96" />
            </li>
          ))
        : (data || []).slice(0, 4).map((r) => (
            <li key={r.slug} className="rv">
              <RestaurantCard r={r} />
            </li>
          ))}
    </ul>
  );
}

function Reveal() {
  useReveal([]);
  return null;
}

mountPage("home", {
  "hero-root": <Hero />,
  "popular-root": <PopularDishes />,
  "orbit-root": <OrbitMenu />,
  "restaurants-root": <FeaturedRestaurants />,
  "reveal-root": <Reveal />,
});

