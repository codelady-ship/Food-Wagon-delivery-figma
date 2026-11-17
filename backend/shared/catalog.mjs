// Pure business rules shared by the API (backend/src) and the static demo fallback (frontend/src/lib/demo-api.js).
// Keep this file free of Node or browser APIs so both sides can import it.

export const CATEGORIES = ["italian", "burger", "grill", "asian", "chicken", "healthy", "dessert", "drinks"];
export const CATEGORY_LABELS = {
  italian: "Italian",
  burger: "Burgers",
  grill: "Grill",
  asian: "Asian",
  chicken: "Chicken",
  healthy: "Healthy",
  dessert: "Desserts",
  drinks: "Drinks",
};
export const ORDER_STATUSES = ["received", "preparing", "on_the_way", "ready_for_pickup", "delivered", "cancelled"];
export const STATUS_LABELS = {
  received: "Order received",
  preparing: "Preparing",
  on_the_way: "On the way",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const FREE_DELIVERY_FROM = 30;
export const SORTS = ["recommended", "rating", "delivery", "price_low", "price_high", "name"];

export const round2 = (n) => Math.round(n * 100) / 100;

// Opening hours are Baku time (UTC+4, no DST). Handles closing after midnight ("02:00") and "00:00".
export function bakuMinutes(now = new Date()) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 240) % 1440;
}
const toMin = (hm) => {
  const [h, m] = String(hm || "00:00").split(":").map(Number);
  return h * 60 + m;
};
export function isOpenNow(r, now = new Date()) {
  const t = bakuMinutes(now);
  const open = toMin(r.opensAt);
  let close = toMin(r.closesAt);
  if (close === 0) close = 1440;
  if (close > open) return t >= open && t < close;
  return t >= open || t < close; // past midnight
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Filter + sort restaurants. `dishes` is optional and lets the text search match dish names.
 * query: { q, cuisine, price (1-3, or "1,2"), minRating, maxDelivery, openNow, sort, discount }
 */
export function searchRestaurants(restaurants, dishes = [], query = {}, now = new Date()) {
  const q = norm(query.q).slice(0, 60);
  const cuisine = norm(query.cuisine);
  const prices = String(query.price || "")
    .split(",")
    .map(Number)
    .filter((n) => n >= 1 && n <= 3);
  const minRating = Number(query.minRating) || 0;
  const maxDelivery = Number(query.maxDelivery) || 0;
  const openOnly = query.openNow === true || query.openNow === "true" || query.openNow === "1";
  const dealsOnly = query.deals === true || query.deals === "true" || query.deals === "1";

  let rows = restaurants.map((r) => ({ ...r, openNow: isOpenNow(r, now) }));
  if (q) {
    const dishHits = new Set(
      dishes.filter((d) => d.available !== false && (norm(d.name).includes(q) || norm(d.description).includes(q))).map((d) => d.restaurant)
    );
    rows = rows.filter(
      (r) =>
        norm(r.name).includes(q) ||
        norm(r.description).includes(q) ||
        (r.cuisines || []).some((c) => c.includes(q) || norm(CATEGORY_LABELS[c]).includes(q)) ||
        dishHits.has(r.slug)
    );
  }
  if (cuisine && cuisine !== "all") rows = rows.filter((r) => (r.cuisines || []).includes(cuisine));
  if (prices.length) rows = rows.filter((r) => prices.includes(r.priceLevel));
  if (minRating) rows = rows.filter((r) => r.rating >= minRating);
  if (maxDelivery) rows = rows.filter((r) => r.deliveryTime <= maxDelivery);
  if (openOnly) rows = rows.filter((r) => r.openNow);
  if (dealsOnly) rows = rows.filter((r) => r.discount > 0);

  const by = {
    rating: (a, b) => b.rating - a.rating,
    delivery: (a, b) => a.deliveryTime - b.deliveryTime,
    price_low: (a, b) => a.priceLevel - b.priceLevel || b.rating - a.rating,
    price_high: (a, b) => b.priceLevel - a.priceLevel || b.rating - a.rating,
    name: (a, b) => a.name.localeCompare(b.name),
    recommended: (a, b) => Number(b.openNow) - Number(a.openNow) || (a.order ?? 0) - (b.order ?? 0),
  };
  return rows.sort(by[query.sort] || by.recommended);
}

export function filterDishes(dishes, query = {}) {
  const q = norm(query.q).slice(0, 60);
  return dishes.filter(
    (d) =>
      d.available !== false &&
      (!query.cat || query.cat === "all" || d.cat === query.cat) &&
      (!query.restaurant || d.restaurant === query.restaurant) &&
      (!query.popular || d.popular) &&
      (!query.featured || d.featured) &&
      (!q || norm(d.name).includes(q) || norm(d.restaurantName).includes(q))
  );
}

/** Returns null when the promo applies, or a human-readable reason when it does not. */
export function promoProblem(promo, subtotal, now = new Date()) {
  if (!promo || promo.active === false) return "This promo code does not exist or is no longer active";
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return "This promo code has expired";
  if (promo.maxUses && promo.uses >= promo.maxUses) return "This promo code has been fully used";
  if (subtotal < (promo.minSubtotal || 0)) return `This code needs a subtotal of at least $${(promo.minSubtotal || 0).toFixed(2)}`;
  return null;
}

/**
 * Prices an order. lines: [{ price, qty, restaurant }]; restaurants: [{ slug, deliveryFee }].
 * Delivery fee = highest fee of the restaurants in the cart, free from FREE_DELIVERY_FROM.
 */
export function priceOrder({ lines, mode = "delivery", restaurants = [], promo = null, now = new Date() }) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const fees = lines.map((l) => restaurants.find((r) => r.slug === l.restaurant)?.deliveryFee ?? 2.5);
  let deliveryFee = mode === "delivery" && subtotal < FREE_DELIVERY_FROM ? Math.max(0, ...fees) : 0;
  let discount = 0;
  const promoError = promo ? promoProblem(promo, subtotal, now) : null;
  if (promo && !promoError) {
    if (promo.type === "percent") discount = round2((subtotal * promo.value) / 100);
    else if (promo.type === "fixed") discount = Math.min(promo.value, subtotal);
    else if (promo.type === "free_delivery") deliveryFee = 0;
  }
  return { subtotal, deliveryFee: round2(deliveryFee), discount: round2(discount), total: round2(subtotal - discount + deliveryFee), promoError };
}

// Demo status timeline: orders move forward on their own unless an admin set the status by hand.
const FLOW = {
  delivery: [["received", 0], ["preparing", 1], ["on_the_way", 4], ["delivered", 12]],
  pickup: [["received", 0], ["preparing", 1], ["ready_for_pickup", 6], ["delivered", 20]],
};
export function statusSteps(mode) {
  return FLOW[mode === "pickup" ? "pickup" : "delivery"].map(([s]) => s);
}
export function simulatedStatus(order, now = new Date()) {
  if (order.manualStatus || order.status === "cancelled") return order.status;
  const mins = (now - new Date(order.createdAt)) / 60000;
  let status = "received";
  for (const [s, at] of FLOW[order.mode === "pickup" ? "pickup" : "delivery"]) if (mins >= at) status = s;
  return status;
}

export function slugify(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
