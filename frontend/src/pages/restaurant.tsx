import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api.js";
import { toast, useAsync, useAuth, useCart } from "@/lib/hooks";
import { errorMessage, fieldErrors, formatDate, imgSrc, money, priceLevel, qs } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { mountPage } from "@/components/site/shell";
import { DishCard, ErrorBox, FavButton, LABELS, Skeleton, Stars, type Dish, type Restaurant } from "@/components/site/cards";

type Review = { id: string; authorName: string; rating: number; comment: string; createdAt: string; userId?: string | null };
type Detail = Restaurant & { dishes: Dish[]; reviews: Review[] };

function setHead(r: Detail) {
  const url = `${location.origin}${location.pathname}?slug=${r.slug}`;
  document.title = `${r.name} – menu, prices and delivery | Food Wagon`;
  const desc = `${r.name}: ${r.description} Rated ${r.rating}/5, delivery in about ${r.deliveryTime} min in Baku. Order online on Food Wagon (demo).`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", desc);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", url);
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    description: r.description,
    url,
    image: new URL(imgSrc(r.image), location.href).href,
    servesCuisine: r.cuisines.map((c) => LABELS[c] || c),
    priceRange: priceLevel(r.priceLevel),
    address: { "@type": "PostalAddress", streetAddress: r.address, addressLocality: "Baku", addressCountry: "AZ" },
    openingHours: `Mo-Su ${r.opensAt}-${r.closesAt}`,
    aggregateRating: { "@type": "AggregateRating", ratingValue: r.rating, reviewCount: r.ratingCount },
    hasMenu: {
      "@type": "Menu",
      hasMenuItem: r.dishes.map((d) => ({ "@type": "MenuItem", name: d.name, description: d.description, offers: { "@type": "Offer", price: d.price, priceCurrency: "USD" } })),
    },
  });
  document.head.appendChild(ld);
}

function ReviewForm({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const auth = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!auth)
    return (
      <p className="rounded-xl bg-muted p-5">
        <a href={`account.html?next=${encodeURIComponent(`restaurant.html?slug=${slug}`)}`} className="font-semibold text-primary-strong underline">
          Sign in
        </a>{" "}
        to rate this restaurant.
      </p>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api(`/restaurants/${slug}/reviews`, { method: "POST", body: { rating, comment } });
      toast("Thanks! Your review is saved.");
      setComment("");
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-muted p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span className="grid size-11 place-items-center rounded-lg text-2xl peer-focus-visible:outline-3 peer-focus-visible:outline-ring" aria-hidden="true" style={{ color: n <= rating ? "#FFB30E" : "#d9cbb5" }}>
                ★
              </span>
              <span className="sr-only">
                {n} star{n > 1 ? "s" : ""}
              </span>
            </label>
          ))}
        </div>
        {errors.rating ? <p className="field-error">{errors.rating}</p> : null}
      </fieldset>
      <Field id="review-comment" label="Comment (optional)" error={errors.comment}>
        <Textarea maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you order? How was it?" />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Post review"}
      </Button>
    </form>
  );
}

function RestaurantPage() {
  const slug = qs("slug");
  const cart = useCart();
  const { data, error, loading, reload } = useAsync(() => (slug ? (api(`/restaurants/${encodeURIComponent(slug)}`) as Promise<Detail>) : Promise.reject(new Error("No restaurant selected."))), [slug]);
  useEffect(() => {
    if (data) setHead(data);
  }, [data]);

  if (loading)
    return (
      <div className="container-x space-y-6 py-10">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  if (error || !data)
    return (
      <div className="container-x py-16">
        <h1 className="display text-5xl">Restaurant not found</h1>
        <div className="mt-6">{error ? <ErrorBox error={error} onRetry={reload} /> : null}</div>
        <LinkButton href="restaurants.html" className="mt-6">
          Browse restaurants
        </LinkButton>
      </div>
    );

  const r = data;
  const cats = [...new Set(r.dishes.map((d) => d.cat))];
  const count = cart.items.reduce((n: number, i: { qty: number }) => n + i.qty, 0);
  const subtotal = cart.items.reduce((s: number, i: { price: number; qty: number }) => s + i.price * i.qty, 0);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-coffee text-background">
        <img src={imgSrc(r.image)} alt="" width={1200} height={600} className="absolute inset-0 -z-10 size-full object-cover opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-coffee via-coffee/85 to-transparent" aria-hidden="true" />
        <div className="container-x py-12 md:py-20">
          <nav aria-label="Breadcrumb" className="mono text-background/75">
            <a href="index.html" className="inline-flex min-h-11 items-center hover:text-white">Home</a> / <a href="restaurants.html" className="inline-flex min-h-11 items-center hover:text-white">Restaurants</a> / <span aria-current="page">{r.name}</span>
          </nav>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="display text-[clamp(2.8rem,7vw,6rem)]">{r.name}</h1>
              <p className="mt-4 text-lg text-background/85">{r.description}</p>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Stars value={r.rating} /> <span className="text-background/75">({r.ratingCount} ratings)</span>
                </li>
                <li>{r.cuisines.map((c) => LABELS[c] || c).join(" · ")}</li>
                <li aria-label={`Price level ${r.priceLevel} of 3`}>{priceLevel(r.priceLevel)}</li>
                <li>{r.deliveryTime} min · {r.deliveryFee ? `${money(r.deliveryFee)} delivery` : "free delivery"}</li>
                <li>
                  {r.opensAt}–{r.closesAt} Baku time ·{" "}
                  <strong className={r.openNow ? "text-[#9be3b0]" : "text-[#ffb4a8]"}>{r.openNow ? "Open now" : "Closed now"}</strong>
                </li>
                {r.address ? <li>{r.address}</li> : null}
              </ul>
            </div>
            <div className="flex items-center gap-3">
              {r.discount ? <span className="rounded-lg bg-primary px-3 py-2 font-bold">-{r.discount}% today</span> : null}
              <FavButton slug={r.slug} name={r.name} />
            </div>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          <nav aria-label="Menu categories" className="sticky top-[72px] z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur">
            {cats.map((c) => (
              <a key={c} href={`#cat-${c}`} className="mono inline-flex min-h-11 shrink-0 items-center rounded-full border border-foreground/15 px-4 text-[0.7rem] no-underline hover:border-foreground">
                {LABELS[c] || c}
              </a>
            ))}
          </nav>
          {!r.openNow ? <p className="mb-6 rounded-xl bg-[#fdf0ee] p-4 text-danger">This restaurant is closed right now. You can still place a demo order for when it opens at {r.opensAt}.</p> : null}
          {cats.map((c) => (
            <section key={c} id={`cat-${c}`} aria-labelledby={`h-${c}`} className="mb-12 scroll-mt-36">
              <h2 id={`h-${c}`} className="mb-5 text-3xl font-semibold">
                {LABELS[c] || c}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {r.dishes
                  .filter((d) => d.cat === c)
                  .map((d) => (
                    <li key={d.slug}>
                      <DishCard d={d} showRestaurant={false} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          {r.dishes.length === 0 ? <p className="text-muted-foreground">This restaurant has no dishes on the menu right now.</p> : null}

          <section aria-labelledby="reviews-title" className="mt-4 border-t border-border pt-10">
            <h2 id="reviews-title" className="text-3xl font-semibold">
              Reviews <span className="text-muted-foreground">({r.reviews.length})</span>
            </h2>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <ul className="space-y-4">
                {r.reviews.length === 0 ? <li className="text-muted-foreground">No written reviews yet. Be the first.</li> : null}
                {r.reviews.map((v) => (
                  <li key={v.id} className="rounded-xl bg-card p-5 ring-1 ring-foreground/5">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{v.authorName}</strong>
                      <Stars value={v.rating} />
                    </div>
                    {v.comment ? <p className="mt-2 text-muted-foreground">{v.comment}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(v.createdAt)}</p>
                  </li>
                ))}
              </ul>
              <ReviewForm slug={r.slug} onSaved={reload} />
            </div>
          </section>
        </div>

        <aside aria-label="Cart summary" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-foreground p-6 text-background">
            <h2 className="text-2xl font-semibold">Your cart</h2>
            <p className="mt-2 text-background/75">{count ? `${count} item${count === 1 ? "" : "s"} · ${money(subtotal)}` : "Your cart is empty. Add a dish to start."}</p>
            <LinkButton href="cart.html" className="mt-5 w-full" aria-disabled={!count}>
              View cart
            </LinkButton>
          </div>
        </aside>
      </div>
    </>
  );
}

mountPage("restaurants", { root: <RestaurantPage /> });
