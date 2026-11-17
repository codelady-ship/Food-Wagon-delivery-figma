import { useMemo } from "react";
import { api } from "@/lib/api.js";
import { toast, useAsync } from "@/lib/hooks";
import { imgSrc } from "@/lib/utils";
import { DishOrbitCarousel, type Dish as OrbitDish } from "@/components/ui/dish-orbit-carousel";
import { addDish, Skeleton, type Dish, type Restaurant } from "./cards";

const LIKED_KEY = "fw-liked-dishes";
function likedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveLiked(s: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/** "Most loved" scroll-pinned orbit menu, fed by /api/dishes?featured=true (demo data as fallback). */
export function OrbitMenu() {
  const { data, loading } = useAsync(
    () => Promise.all([api("/dishes?featured=true") as Promise<Dish[]>, api("/restaurants") as Promise<Restaurant[]>]),
    []
  );
  const liked = useMemo(likedSet, []);

  const { dishes, source, initialLiked } = useMemo(() => {
    const [rows = [], rests = []] = data || [];
    const rating = Object.fromEntries(rests.map((r) => [r.slug, r.rating]));
    const init: Record<number, boolean> = {};
    const mapped: OrbitDish[] = rows.map((d, i) => {
      const wasLiked = liked.has(d.slug);
      if (wasLiked) init[i] = true;
      const [title, subtitle] = d.headline?.length === 2 ? d.headline : [d.name.split(" ").slice(0, -1).join(" ") || d.name, d.name.split(" ").slice(-1)[0]];
      return {
        id: d.slug,
        title,
        subtitle,
        label: d.name,
        image: imgSrc(d.cutout || d.image),
        alt: d.alt || d.name,
        eyebrow: `#${i + 1} most loved · $${d.price.toFixed(2)}`,
        rating: rating[d.restaurant] ?? 4.5,
        chef: d.chef || d.restaurantName,
        kitchen: d.restaurantName,
        description: d.description || "",
        likes: Math.max(0, (d.likes || 0) - (wasLiked ? 1 : 0)), // the component adds the viewer's own like
        ingredients: d.ingredients || [],
        accent: d.accent || "#F17228",
      };
    });
    return { dishes: mapped, source: rows, initialLiked: init };
  }, [data, liked]);

  if (loading) return <Skeleton className="container-x h-[60svh]" />;
  if (!dishes.length) return null;

  return (
    <DishOrbitCarousel
      dishes={dishes}
      height="calc(100svh - 72px)"
      loop={false}
      initialLiked={initialLiked}
      onOrder={(_d, i) => addDish(source[i])}
      onSearch={() => {
        window.location.href = "restaurants.html#search";
      }}
      onMenu={() => {
        window.location.href = "restaurants.html";
      }}
      onLike={async (_d, i, isLiked) => {
        const slug = source[i].slug;
        try {
          await api(`/dishes/${slug}/like`, { method: "POST", body: { action: isLiked ? "like" : "unlike" } });
          if (isLiked) liked.add(slug);
          else liked.delete(slug);
          saveLiked(liked);
        } catch {
          toast("Could not save your like, please try again", "error");
        }
      }}
      onDislike={(_d, _i, disliked) => {
        if (disliked) toast("Thanks for the feedback");
      }}
    />
  );
}
