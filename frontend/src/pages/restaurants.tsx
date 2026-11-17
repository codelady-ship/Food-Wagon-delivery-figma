import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api.js";
import { useAsync, useReveal } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { ErrorBox, LABELS, RestaurantCard, Skeleton, type Restaurant } from "@/components/site/cards";

type Filters = { q: string; cuisine: string; price: string; minRating: string; maxDelivery: string; openNow: boolean; deals: boolean; sort: string };
const EMPTY: Filters = { q: "", cuisine: "all", price: "", minRating: "", maxDelivery: "", openNow: false, deals: false, sort: "recommended" };

function fromUrl(): Filters {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") || "",
    cuisine: p.get("cuisine") || "all",
    price: p.get("price") || "",
    minRating: p.get("minRating") || "",
    maxDelivery: p.get("maxDelivery") || "",
    openNow: p.get("openNow") === "true",
    deals: p.get("deals") === "1" || p.get("deals") === "true",
    sort: p.get("sort") || "recommended",
  };
}
function toQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cuisine !== "all") p.set("cuisine", f.cuisine);
  if (f.price) p.set("price", f.price);
  if (f.minRating) p.set("minRating", f.minRating);
  if (f.maxDelivery) p.set("maxDelivery", f.maxDelivery);
  if (f.openNow) p.set("openNow", "true");
  if (f.deals) p.set("deals", "true");
  if (f.sort !== "recommended") p.set("sort", f.sort);
  return p.toString();
}

function RestaurantsPage() {
  const [f, setF] = useState<Filters>(fromUrl);
  const [q, setQ] = useState(f.q);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const query = toQuery(f);
  const { data, error, loading, reload } = useAsync(() => api(`/restaurants${query ? `?${query}` : ""}`) as Promise<Restaurant[]>, [query]);
  useReveal([data]);

  useEffect(() => {
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }, [query]);
  useEffect(() => {
    if (location.hash === "#search") searchRef.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setF((s) => (s.q === q.trim() ? s : { ...s, q: q.trim() })), 300);
    return () => clearTimeout(t);
  }, [q]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((s) => ({ ...s, [k]: v }));
  const prices = f.price ? f.price.split(",") : [];
  const togglePrice = (p: string) => set("price", (prices.includes(p) ? prices.filter((x) => x !== p) : [...prices, p]).sort().join(","));
  const active = query.replace(/(^|&)sort=[^&]*/, "") !== "";

  return (
    <div className="container-x py-10 md:py-14">
      <p className="mono text-primary-strong">{f.deals ? "Deals" : "Restaurants"}</p>
      <h1 className="display mt-3 text-[clamp(2.6rem,7vw,6rem)]">{f.deals ? "Restaurants with deals." : "Find your next favourite."}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Food Wagon lists 8 demo restaurants in Baku. Filter by cuisine, price, rating, delivery time and opening hours (Baku time).</p>

      <form className="mt-8" role="search" onSubmit={(e) => e.preventDefault()} aria-label="Search restaurants">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="search" className="sr-only">
            Search restaurants or dishes
          </label>
          <Input id="search" ref={searchRef} type="search" placeholder="Search restaurants or dishes, e.g. ramen" value={q} onChange={(e) => setQ(e.target.value)} className="sm:flex-1" />
          <div className="flex gap-3">
            <label htmlFor="sort" className="sr-only">
              Sort by
            </label>
            <Select id="sort" value={f.sort} onChange={(e) => set("sort", e.target.value)} className="sm:w-52">
              <option value="recommended">Recommended</option>
              <option value="rating">Highest rated</option>
              <option value="delivery">Fastest delivery</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </Select>
            <Button variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="filters" onClick={() => setShowFilters((s) => !s)}>
              Filters
            </Button>
          </div>
        </div>

        <fieldset id="filters" className={cn("mt-4 grid gap-4 rounded-2xl bg-muted p-4 sm:grid-cols-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto]", showFilters ? "grid" : "hidden")}>
          <legend className="sr-only">Filters</legend>
          <div>
            <span className="mb-1.5 block text-sm font-semibold" id="cuisine-label">
              Cuisine
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cuisine-label">
              {["all", ...Object.keys(LABELS)].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={f.cuisine === c}
                  onClick={() => set("cuisine", c)}
                  className={cn("min-h-11 rounded-full border px-3.5 text-sm transition-colors", f.cuisine === c ? "border-foreground bg-foreground text-background" : "border-foreground/15 bg-card hover:border-foreground")}
                >
                  {c === "all" ? "All" : LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-semibold" id="price-label">
              Price
            </span>
            <div className="flex gap-2" role="group" aria-labelledby="price-label">
              {["1", "2", "3"].map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={prices.includes(p)}
                  aria-label={`Price level ${p} of 3`}
                  onClick={() => togglePrice(p)}
                  className={cn("min-h-11 min-w-12 rounded-lg border px-3 font-semibold", prices.includes(p) ? "border-primary bg-primary text-white" : "border-foreground/15 bg-card")}
                >
                  {"$".repeat(Number(p))}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="minRating" className="mb-1.5 block text-sm font-semibold">
              Rating
            </label>
            <Select id="minRating" value={f.minRating} onChange={(e) => set("minRating", e.target.value)}>
              <option value="">Any</option>
              <option value="4.5">4.5+</option>
              <option value="4.3">4.3+</option>
              <option value="4">4.0+</option>
            </Select>
          </div>
          <div>
            <label htmlFor="maxDelivery" className="mb-1.5 block text-sm font-semibold">
              Delivery time
            </label>
            <Select id="maxDelivery" value={f.maxDelivery} onChange={(e) => set("maxDelivery", e.target.value)}>
              <option value="">Any</option>
              <option value="20">Up to 20 min</option>
              <option value="30">Up to 30 min</option>
              <option value="40">Up to 40 min</option>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-[#F17228]" checked={f.openNow} onChange={(e) => set("openNow", e.target.checked)} /> Open now
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-[#F17228]" checked={f.deals} onChange={(e) => set("deals", e.target.checked)} /> Deals only
            </label>
          </div>
        </fieldset>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 aria-live="polite" className="font-sans text-base leading-normal font-semibold tracking-normal">
          {loading ? "Searching..." : `${data?.length ?? 0} restaurant${data?.length === 1 ? "" : "s"} found`}
        </h2>
        {active ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setF({ ...EMPTY, sort: f.sort });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBox error={error} onRetry={reload} /> : null}
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 8 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-96" />
              </li>
            ))
          : (data || []).map((r) => (
              <li key={r.slug} className="rv">
                <RestaurantCard r={r} />
              </li>
            ))}
      </ul>
      {!loading && data && data.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-muted p-8 text-center">
          <p className="text-lg font-semibold">No restaurants match these filters.</p>
          <p className="mt-1 text-muted-foreground">Try another cuisine, a longer delivery time or turn off "Open now".</p>
        </div>
      ) : null}
    </div>
  );
}

mountPage("restaurants", { root: <RestaurantsPage /> });
