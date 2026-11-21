// In-browser stand-in for the Express API, used when the API is not configured or unreachable.
// Same routes and rules (shared/catalog.mjs), data from backend/data/seed.json, changes kept in localStorage.
import seed from "../../../backend/data/seed.json";
import * as catalog from "../../../backend/shared/catalog.mjs";
import { ApiError } from "./errors.js";

const DB_KEY = "fw-demo-db-v1";
export const DEMO_ADMIN = { email: "admin@foodwagon.demo", password: "demo-admin" };

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const now = () => new Date();
const id = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16);

// Fictional rows so the admin sandbox has something to show (names, phones and emails are invented;
// totals are priced by the same rules as real orders, so Overview adds up with the Orders tab).
const SAMPLE_ORDERS = [
  ["FW-5A0001", "delivery", "preparing", 0.2, [["veggie-pizza", 2], ["fresh-orange-juice", 2]], "Aylin Sample", "12 Sample Street, Baku", "WELCOME10", "Ring the bell twice, please."],
  ["FW-5A0002", "pickup", "ready_for_pickup", 0.6, [["classic-cheeseburger", 1], ["crispy-fried-chicken", 1]], "Tural Example", "", "", ""],
  ["FW-5A0003", "delivery", "on_the_way", 1.5, [["salmon-sushi-set", 1], ["rainbow-salad-bowl", 1]], "Nigar Placeholder", "5 Demo Avenue, Baku", "", ""],
  ["FW-5A0004", "delivery", "delivered", 26, [["tonkotsu-ramen", 2], ["yuzu-lemonade", 2]], "Kamran Sample", "41 Example Lane, Baku", "FREESHIP", ""],
  ["FW-5A0005", "delivery", "delivered", 50, [["margherita-pizza", 1], ["garlic-penne", 1], ["morning-juice", 2]], "Sabina Example", "9 Placeholder Road, Baku", "", "No onions."],
  ["FW-5A0006", "pickup", "cancelled", 74, [["berry-pancakes", 2]], "Elvin Placeholder", "", "", ""],
];
const SAMPLE_MESSAGES = [
  ["Aylin Sample", "aylin@example.com", "feedback", "The veggie pizza was still hot when it arrived. Thank you!", false, 3],
  ["Tural Example", "tural@example.com", "partner", "We run a small bakery and would like to join Food Wagon. Who can we talk to?", false, 20],
  ["Nigar Placeholder", "nigar@example.com", "order", "My order arrived without the juice. It was refunded quickly, thanks.", true, 49],
];
const SAMPLE_SUBSCRIBERS = [["aylin@example.com", 3], ["kamran@example.com", 30], ["sabina@example.com", 52], ["elvin@example.com", 80]];

function addSamples(db) {
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const orders = SAMPLE_ORDERS.map(([reference, mode, status, hours, lines, name, address, promoCode, note], n) => {
    const items = lines
      .map(([slug, qty]) => [db.dishes.find((d) => d.slug === slug), qty])
      .filter(([d]) => d)
      .map(([d, qty]) => ({ dish: d.slug, name: d.name, restaurant: d.restaurant, restaurantName: d.restaurantName, price: d.price, qty }));
    const promo = db.promos.find((p) => p.code === promoCode) || null;
    const price = catalog.priceOrder({ lines: items, mode, restaurants: db.restaurants, promo });
    return {
      reference,
      userId: null,
      items,
      mode,
      customer: { name, phone: `+994 00 000 00 0${n + 1}`, email: `${name.split(" ")[0].toLowerCase()}@example.com`, address },
      note,
      promoCode: promo && !price.promoError ? promo.code : "",
      payment: n % 2 ? "cash" : "card_demo",
      subtotal: price.subtotal,
      discount: price.discount,
      deliveryFee: price.deliveryFee,
      total: price.total,
      status,
      manualStatus: true,
      sample: true,
      createdAt: ago(hours),
    };
  }).filter((o) => o.items.length && !db.orders.some((x) => x.reference === o.reference));
  db.orders.push(...orders);
  db.messages.push(...SAMPLE_MESSAGES.map(([name, email, topic, message, handled, hours], n) => ({ id: `m-sample-${n}`, name, email, topic, message, handled, sample: true, createdAt: ago(hours) })));
  db.subscribers.push(...SAMPLE_SUBSCRIBERS.filter(([email]) => !db.subscribers.some((s) => s.email === email)).map(([email, hours], n) => ({ id: `s-sample-${n}`, email, sample: true, createdAt: ago(hours) })));
  db.sampled = true;
}

let memoryDb = null;
function load() {
  if (memoryDb) return memoryDb;
  try {
    memoryDb = JSON.parse(localStorage.getItem(DB_KEY));
  } catch {
    memoryDb = null;
  }
  if (!memoryDb) {
    const names = Object.fromEntries(seed.restaurants.map((r) => [r.slug, r.name]));
    const t = new Date("2026-11-01T10:00:00Z").toISOString();
    memoryDb = {
      restaurants: seed.restaurants.map((r, i) => ({ ...r, id: `r${i}`, order: i, baseRating: r.rating, baseCount: r.ratingCount })),
      dishes: seed.dishes.map((d, i) => ({ ...d, id: `d${i}`, restaurantName: names[d.restaurant], order: i, available: true })),
      promos: seed.promos.map((p, i) => ({ ...p, id: `p${i}`, active: true, uses: 0, maxUses: 0, expiresAt: null })),
      reviews: seed.reviews.map((r, i) => ({ ...r, id: `v${i}`, userId: null, createdAt: t })),
      orders: [],
      users: [],
      subscribers: [],
      messages: [],
    };
  }
  if (!memoryDb.sampled) addSamples(memoryDb); // also tops up a sandbox saved before the samples existed
  return memoryDb;
}
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(memoryDb));
  } catch {
    /* quota or blocked: keep in memory */
  }
}
export function resetDemoData() {
  memoryDb = null;
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- helpers ---------- */
const fail = (status, message, details) => {
  throw new ApiError(status, message, details);
};
const invalid = (details) => fail(400, "Validation failed", details);
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());
const phoneOk = (s) => /^[+]?[0-9 ()-]{7,20}$/.test(String(s || "").trim());
const slugOk = (s) => /^[a-z0-9-]{2,60}$/.test(String(s || ""));
const str = (v) => String(v ?? "").trim();
function check(rules) {
  const details = rules.filter(([ok]) => !ok).map(([, field, message]) => ({ field, message }));
  if (details.length) invalid(details);
}
async function hash(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fw-demo:${pw}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, favourites: u.favourites };
const stripRestaurant = ({ baseRating, baseCount, ...r }) => r;

function currentUser(db, token) {
  if (!token || !token.startsWith("demo.")) return null;
  return db.users.find((u) => u.id === token.slice(5)) || null;
}
function requireUser(db, token) {
  const u = currentUser(db, token);
  if (!u) fail(401, "Please log in");
  return u;
}
function requireAdmin(db, token) {
  const u = requireUser(db, token);
  if (u.role !== "admin") fail(403, "Admins only");
  return u;
}

function publicOrder(o) {
  const status = catalog.simulatedStatus(o);
  return {
    reference: o.reference,
    status,
    statusLabel: catalog.STATUS_LABELS[status],
    steps: catalog.statusSteps(o.mode),
    mode: o.mode,
    items: o.items,
    promoCode: o.promoCode,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    payment: o.payment,
    createdAt: o.createdAt,
  };
}

function refreshRating(db, slug) {
  const r = db.restaurants.find((x) => x.slug === slug);
  const mine = db.reviews.filter((v) => v.restaurant === slug && v.userId);
  const sum = mine.reduce((s, v) => s + v.rating, 0);
  r.ratingCount = r.baseCount + mine.length;
  r.rating = Math.round(((r.baseRating * r.baseCount + sum) / Math.max(1, r.ratingCount)) * 10) / 10;
}

function validateRestaurant(b, partial) {
  const has = (k) => !partial || b[k] !== undefined;
  check([
    [!has("slug") || slugOk(b.slug), "slug", "Use lowercase letters, digits and dashes"],
    [!has("name") || str(b.name).length >= 2, "name", "Enter a name"],
    [!has("cuisines") || (Array.isArray(b.cuisines) && b.cuisines.length > 0 && b.cuisines.every((c) => catalog.CATEGORIES.includes(c))), "cuisines", "Pick at least one cuisine"],
    [!has("priceLevel") || [1, 2, 3].includes(Number(b.priceLevel)), "priceLevel", "Price level is 1-3"],
    [!has("deliveryTime") || (Number(b.deliveryTime) >= 5 && Number(b.deliveryTime) <= 120), "deliveryTime", "5-120 minutes"],
    [!has("deliveryFee") || (Number(b.deliveryFee) >= 0 && Number(b.deliveryFee) <= 20), "deliveryFee", "0-20"],
    [!has("image") || str(b.image).length > 0, "image", "Add an image"],
    [!has("opensAt") || /^\d{2}:\d{2}$/.test(b.opensAt), "opensAt", "Use HH:MM"],
    [!has("closesAt") || /^\d{2}:\d{2}$/.test(b.closesAt), "closesAt", "Use HH:MM"],
  ]);
  const out = { ...b };
  ["priceLevel", "deliveryTime", "deliveryFee", "rating", "ratingCount", "discount"].forEach((k) => out[k] !== undefined && out[k] !== "" && (out[k] = Number(out[k])));
  return out;
}
function validateDish(db, b, partial) {
  const has = (k) => !partial || b[k] !== undefined;
  check([
    [!has("slug") || slugOk(b.slug), "slug", "Use lowercase letters, digits and dashes"],
    [!has("name") || str(b.name).length >= 2, "name", "Enter a name"],
    [!has("restaurant") || db.restaurants.some((r) => r.slug === b.restaurant), "restaurant", "Unknown restaurant"],
    [!has("price") || (Number(b.price) >= 0.5 && Number(b.price) <= 500), "price", "Price must be 0.50-500"],
    [!has("cat") || catalog.CATEGORIES.includes(b.cat), "cat", "Pick a category"],
    [!has("image") || str(b.image).length > 0, "image", "Add an image"],
  ]);
  const out = { ...b };
  if (out.price !== undefined) out.price = Number(out.price);
  if (out.restaurant) out.restaurantName = db.restaurants.find((r) => r.slug === out.restaurant).name;
  return out;
}
function validatePromo(b, partial) {
  const has = (k) => !partial || b[k] !== undefined;
  const out = { ...b };
  if (out.code) out.code = str(out.code).toUpperCase();
  check([
    [!has("code") || /^[A-Z0-9_-]{3,20}$/.test(out.code), "code", "3-20 letters, digits, - or _"],
    [!has("type") || ["percent", "fixed", "free_delivery"].includes(b.type), "type", "Pick a type"],
    [b.value === undefined || (Number(b.value) >= 0 && Number(b.value) <= 100), "value", "0-100"],
  ]);
  ["value", "minSubtotal", "maxUses"].forEach((k) => out[k] !== undefined && (out[k] = Number(out[k]) || 0));
  if (out.expiresAt === "") out.expiresAt = null;
  return out;
}

async function fileToDataUrl(file) {
  if (!file || !file.type) invalid([{ field: "image", message: "Choose an image file" }]);
  if (!["image/webp", "image/jpeg", "image/png", "image/avif"].includes(file.type)) fail(400, "Upload a WebP, JPEG, PNG or AVIF image");
  if (file.size > 800 * 1024) fail(413, "Image is too large (max 800 KB)");
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ---------- routes ---------- */
const routes = [];
const on = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler });

on("GET", "/health", () => ({ ok: true, db: "demo" }));
on("GET", "/meta", () => ({
  categories: catalog.CATEGORIES.map((key) => ({ key, label: catalog.CATEGORY_LABELS[key] })),
  sorts: catalog.SORTS,
  freeDeliveryFrom: catalog.FREE_DELIVERY_FROM,
  statuses: catalog.STATUS_LABELS,
}));
on("GET", "/restaurants", ({ db, query }) => catalog.searchRestaurants(db.restaurants.map(stripRestaurant), db.dishes, query));
on("GET", "/restaurants/:slug", ({ db, params }) => {
  const r = db.restaurants.find((x) => x.slug === params.slug) || fail(404, "Restaurant not found");
  return {
    ...stripRestaurant(r),
    openNow: catalog.isOpenNow(r),
    dishes: db.dishes.filter((d) => d.restaurant === r.slug && d.available !== false),
    reviews: db.reviews.filter((v) => v.restaurant === r.slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
});
on("POST", "/restaurants/:slug/reviews", ({ db, params, body, token }) => {
  const user = requireUser(db, token);
  const r = db.restaurants.find((x) => x.slug === params.slug) || fail(404, "Restaurant not found");
  const rating = Number(body.rating);
  check([[Number.isInteger(rating) && rating >= 1 && rating <= 5, "rating", "Pick 1 to 5 stars"], [str(body.comment).length <= 500, "comment", "Max 500 characters"]]);
  let review = db.reviews.find((v) => v.restaurant === r.slug && v.userId === user.id);
  if (!review) {
    review = { id: id(), restaurant: r.slug, userId: user.id, createdAt: now().toISOString() };
    db.reviews.push(review);
  }
  Object.assign(review, { rating, comment: str(body.comment), authorName: user.name, updatedAt: now().toISOString() });
  refreshRating(db, r.slug);
  return review;
});
on("GET", "/dishes", ({ db, query }) => catalog.filterDishes(db.dishes, { ...query, popular: query.popular === "true", featured: query.featured === "true" }));
on("POST", "/dishes/:slug/like", ({ db, params, body }) => {
  const d = db.dishes.find((x) => x.slug === params.slug) || fail(404, "Dish not found");
  check([[["like", "unlike"].includes(body.action), "action", "Unknown action"]]);
  d.likes = Math.max(0, (d.likes || 0) + (body.action === "like" ? 1 : -1));
  return { slug: d.slug, likes: d.likes };
});
on("GET", "/dishes/:slug", ({ db, params }) => db.dishes.find((d) => d.slug === params.slug) || fail(404, "Dish not found"));

on("POST", "/promos/validate", ({ db, body }) => {
  const promo = db.promos.find((p) => p.code === str(body.code).toUpperCase());
  const problem = catalog.promoProblem(promo, Number(body.subtotal) || 0);
  if (problem) fail(400, problem, [{ field: "promoCode", message: problem }]);
  return { code: promo.code, type: promo.type, value: promo.value, minSubtotal: promo.minSubtotal, description: promo.description };
});

on("POST", "/orders", ({ db, body, token }) => {
  const mode = body.mode === "pickup" ? "pickup" : "delivery";
  check([
    [Array.isArray(body.items) && body.items.length > 0, "items", "Your cart is empty"],
    [str(body.name).length >= 2, "name", "Enter your name"],
    [phoneOk(body.phone), "phone", "Enter a valid phone number"],
    [!str(body.email) || emailOk(body.email), "email", "Enter a valid email address"],
    [mode === "pickup" || str(body.address).length >= 5, "address", "Enter a delivery address (at least 5 characters)"],
  ]);
  const qty = new Map();
  body.items.forEach((i) => qty.set(i.dish, Math.min(20, (qty.get(i.dish) || 0) + Math.max(1, Number(i.qty) || 1))));
  const dishes = [...qty.keys()].map((s) => db.dishes.find((d) => d.slug === s && d.available !== false));
  if (dishes.some((d) => !d)) invalid([{ field: "items", message: "Some dishes are no longer available" }]);
  const items = dishes.map((d) => ({ dish: d.slug, name: d.name, restaurant: d.restaurant, restaurantName: d.restaurantName, price: d.price, qty: qty.get(d.slug) }));
  const code = str(body.promoCode).toUpperCase();
  const promo = code ? db.promos.find((p) => p.code === code) || invalid([{ field: "promoCode", message: "This promo code does not exist or is no longer active" }]) : null;
  const price = catalog.priceOrder({ lines: items, mode, restaurants: db.restaurants, promo });
  if (price.promoError) invalid([{ field: "promoCode", message: price.promoError }]);
  const user = currentUser(db, token);
  const order = {
    reference: "FW-" + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0"),
    userId: user ? user.id : null,
    items,
    mode,
    customer: { name: str(body.name), phone: str(body.phone), email: str(body.email), address: mode === "delivery" ? str(body.address) : "" },
    note: str(body.note).slice(0, 300),
    promoCode: promo ? promo.code : "",
    payment: body.payment === "cash" ? "cash" : "card_demo",
    subtotal: price.subtotal,
    discount: price.discount,
    deliveryFee: price.deliveryFee,
    total: price.total,
    status: "received",
    manualStatus: false,
    createdAt: now().toISOString(),
  };
  if (promo) promo.uses += 1;
  db.orders.unshift(order);
  return publicOrder(order);
});
on("GET", "/orders/:reference", ({ db, params }) => publicOrder(db.orders.find((o) => o.reference === params.reference.toUpperCase().trim()) || fail(404, "Order not found")));

on("POST", "/newsletter", ({ db, body }) => {
  check([[emailOk(body.email), "email", "Enter a valid email address"]]);
  const email = str(body.email).toLowerCase();
  if (db.subscribers.some((s) => s.email === email)) return { ok: true, message: "You are already subscribed (demo: saved in this browser only)." };
  db.subscribers.unshift({ id: id(), email, createdAt: now().toISOString() });
  return { ok: true, message: "Thanks! You are subscribed. Demo mode: no emails are sent." };
});
on("POST", "/contact", ({ db, body }) => {
  check([
    [str(body.name).length >= 2, "name", "Enter your name"],
    [emailOk(body.email), "email", "Enter a valid email address"],
    [str(body.message).length >= 10, "message", "Write at least 10 characters"],
  ]);
  db.messages.unshift({ id: id(), name: str(body.name), email: str(body.email), topic: body.topic || "other", message: str(body.message), handled: false, createdAt: now().toISOString() });
  return { ok: true, message: "Thanks, your message is saved. Demo mode: it stays in this browser and no email is sent. Sign in to the admin panel to see it." };
});

on("POST", "/auth/register", async ({ db, body }) => {
  check([
    [str(body.name).length >= 2, "name", "Enter your name"],
    [emailOk(body.email), "email", "Enter a valid email address"],
    [String(body.password || "").length >= 8, "password", "Use at least 8 characters"],
  ]);
  const email = str(body.email).toLowerCase();
  if (email === DEMO_ADMIN.email || db.users.some((u) => u.email === email)) fail(409, "An account with this email already exists", [{ field: "email", message: "An account with this email already exists" }]);
  const user = { id: id(), name: str(body.name), email, role: "user", favourites: [], passwordHash: await hash(body.password), createdAt: now().toISOString() };
  db.users.push(user);
  return { token: `demo.${user.id}`, user: publicUser(user) };
});
on("POST", "/auth/login", async ({ db, body }) => {
  const email = str(body.email).toLowerCase();
  if (email === DEMO_ADMIN.email && body.password === DEMO_ADMIN.password && !db.users.some((u) => u.email === email)) {
    db.users.push({ id: "admin", name: "Demo Admin", email, role: "admin", favourites: [], passwordHash: await hash(body.password) });
  }
  const user = db.users.find((u) => u.email === email);
  if (!user || user.passwordHash !== (await hash(body.password))) fail(401, "Wrong email or password");
  return { token: `demo.${user.id}`, user: publicUser(user) };
});
on("GET", "/auth/me", ({ db, token }) => publicUser(requireUser(db, token)));
on("GET", "/me/orders", ({ db, token }) => {
  const u = requireUser(db, token);
  return db.orders.filter((o) => o.userId === u.id).map(publicOrder);
});
on("GET", "/me/favourites", ({ db, token }) => {
  const u = requireUser(db, token);
  return db.restaurants.filter((r) => u.favourites.includes(r.slug)).map((r) => ({ ...stripRestaurant(r), openNow: catalog.isOpenNow(r) }));
});
on("PUT", "/me/favourites/:slug", ({ db, token, params }) => {
  const u = requireUser(db, token);
  if (!db.restaurants.some((r) => r.slug === params.slug)) fail(404, "Restaurant not found");
  if (!u.favourites.includes(params.slug)) u.favourites.push(params.slug);
  return { favourites: u.favourites };
});
on("DELETE", "/me/favourites/:slug", ({ db, token, params }) => {
  const u = requireUser(db, token);
  u.favourites = u.favourites.filter((s) => s !== params.slug);
  return { favourites: u.favourites };
});

/* admin */
on("GET", "/admin/stats", ({ db, token }) => {
  requireAdmin(db, token);
  return {
    orders: db.orders.length,
    revenue: catalog.round2(db.orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0)),
    restaurants: db.restaurants.length,
    dishes: db.dishes.length,
    users: db.users.length,
    subscribers: db.subscribers.length,
    openMessages: db.messages.filter((m) => !m.handled).length,
  };
});
on("GET", "/admin/orders", ({ db, token, query }) => {
  requireAdmin(db, token);
  return db.orders.map((o) => ({ ...o, status: catalog.simulatedStatus(o) })).filter((o) => !query.status || o.status === query.status);
});
on("PATCH", "/admin/orders/:reference", ({ db, token, params, body }) => {
  requireAdmin(db, token);
  check([[catalog.ORDER_STATUSES.includes(body.status), "status", "Unknown status"]]);
  const o = db.orders.find((x) => x.reference === params.reference) || fail(404, "Order not found");
  Object.assign(o, { status: body.status, manualStatus: true });
  return o;
});
on("DELETE", "/admin/orders/:reference", ({ db, token, params }) => {
  requireAdmin(db, token);
  db.orders = db.orders.filter((o) => o.reference !== params.reference);
  return null;
});
on("POST", "/admin/restaurants", ({ db, token, body }) => {
  requireAdmin(db, token);
  const r = validateRestaurant(body, false);
  if (db.restaurants.some((x) => x.slug === r.slug)) fail(409, "Already exists");
  const row = { rating: 0, ratingCount: 0, discount: 0, fast: false, description: "", address: "", alt: "", ...r, id: id(), order: db.restaurants.length };
  row.baseRating = row.rating;
  row.baseCount = row.ratingCount;
  db.restaurants.push(row);
  return row;
});
on("PUT", "/admin/restaurants/:slug", ({ db, token, params, body }) => {
  requireAdmin(db, token);
  const r = db.restaurants.find((x) => x.slug === params.slug) || fail(404, "Restaurant not found");
  const u = validateRestaurant(body, true);
  if (u.slug && u.slug !== r.slug && db.restaurants.some((x) => x.slug === u.slug)) fail(409, "Already exists");
  if (u.rating !== undefined) u.baseRating = u.rating;
  if (u.ratingCount !== undefined) u.baseCount = u.ratingCount;
  const old = r.slug;
  Object.assign(r, u);
  db.dishes.filter((d) => d.restaurant === old).forEach((d) => Object.assign(d, { restaurant: r.slug, restaurantName: r.name }));
  db.reviews.filter((v) => v.restaurant === old).forEach((v) => (v.restaurant = r.slug));
  return r;
});
on("DELETE", "/admin/restaurants/:slug", ({ db, token, params }) => {
  requireAdmin(db, token);
  if (db.dishes.some((d) => d.restaurant === params.slug)) fail(409, "Delete or move this restaurant's dishes first");
  db.restaurants = db.restaurants.filter((r) => r.slug !== params.slug);
  return null;
});
on("GET", "/admin/dishes", ({ db, token }) => {
  requireAdmin(db, token);
  return db.dishes;
});
on("POST", "/admin/dishes", ({ db, token, body }) => {
  requireAdmin(db, token);
  const d = validateDish(db, body, false);
  if (db.dishes.some((x) => x.slug === d.slug)) fail(409, "Already exists");
  const row = { description: "", alt: "", popular: false, available: true, ...d, id: id(), order: db.dishes.length };
  db.dishes.push(row);
  return row;
});
on("PUT", "/admin/dishes/:slug", ({ db, token, params, body }) => {
  requireAdmin(db, token);
  const d = db.dishes.find((x) => x.slug === params.slug) || fail(404, "Dish not found");
  Object.assign(d, validateDish(db, body, true));
  return d;
});
on("DELETE", "/admin/dishes/:slug", ({ db, token, params }) => {
  requireAdmin(db, token);
  db.dishes = db.dishes.filter((d) => d.slug !== params.slug);
  return null;
});
on("GET", "/admin/promos", ({ db, token }) => {
  requireAdmin(db, token);
  return db.promos;
});
on("POST", "/admin/promos", ({ db, token, body }) => {
  requireAdmin(db, token);
  const p = validatePromo(body, false);
  if (db.promos.some((x) => x.code === p.code)) fail(409, "Already exists");
  const row = { value: 0, minSubtotal: 0, description: "", active: true, maxUses: 0, expiresAt: null, ...p, uses: 0, id: id() };
  db.promos.unshift(row);
  return row;
});
on("PUT", "/admin/promos/:code", ({ db, token, params, body }) => {
  requireAdmin(db, token);
  const p = db.promos.find((x) => x.code === params.code.toUpperCase()) || fail(404, "Promo code not found");
  Object.assign(p, validatePromo(body, true));
  return p;
});
on("DELETE", "/admin/promos/:code", ({ db, token, params }) => {
  requireAdmin(db, token);
  db.promos = db.promos.filter((p) => p.code !== params.code.toUpperCase());
  return null;
});
on("GET", "/admin/messages", ({ db, token }) => {
  requireAdmin(db, token);
  return db.messages;
});
on("PATCH", "/admin/messages/:id", ({ db, token, params, body }) => {
  requireAdmin(db, token);
  const m = db.messages.find((x) => x.id === params.id) || fail(404, "Message not found");
  m.handled = Boolean(body.handled);
  return m;
});
on("GET", "/admin/subscribers", ({ db, token }) => {
  requireAdmin(db, token);
  return db.subscribers;
});
on("POST", "/admin/uploads", async ({ db, token, body }) => {
  requireAdmin(db, token);
  const file = body instanceof FormData ? body.get("image") : null;
  const url = await fileToDataUrl(file);
  return { id: id(), url, size: file.size };
});

export async function demoRequest(method, fullPath, body, token) {
  const [path, qs = ""] = fullPath.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  const db = load();
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = path.match(route.re);
    if (!m) continue;
    const params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
    const result = await route.handler({ db, params, query, body: body ?? {}, token });
    if (method !== "GET") save();
    return clone(result);
  }
  return fail(404, "Not found");
}
