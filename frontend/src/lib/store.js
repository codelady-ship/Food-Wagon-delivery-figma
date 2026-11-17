// Browser-side state: cart and login session (localStorage, every access guarded).
const CART_KEY = "fw-cart";
const AUTH_KEY = "fw-auth";

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or blocked storage: state lives for this page only */
  }
}

/* ---------- cart ---------- */
const emptyCart = () => ({ items: [], promo: "", mode: "delivery" });
let cartCache = null;

export function getCart() {
  if (!cartCache) cartCache = { ...emptyCart(), ...read(CART_KEY, {}) };
  return cartCache;
}
function saveCart(cart) {
  cartCache = cart;
  write(CART_KEY, cart);
  window.dispatchEvent(new CustomEvent("cart:change", { detail: cart }));
}
export function cartCount() {
  return getCart().items.reduce((n, i) => n + i.qty, 0);
}
export function cartSubtotal() {
  return Math.round(getCart().items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
}
export function addToCart(dish, qty = 1) {
  const cart = getCart();
  const line = cart.items.find((i) => i.dish === dish.slug);
  if (line) line.qty = Math.min(20, line.qty + qty);
  else
    cart.items.push({
      dish: dish.slug,
      name: dish.name,
      price: dish.price,
      image: dish.image,
      restaurant: dish.restaurant,
      restaurantName: dish.restaurantName,
      qty: Math.min(20, qty),
    });
  saveCart({ ...cart });
}
export function setQty(slug, qty) {
  const cart = getCart();
  cart.items = cart.items.map((i) => (i.dish === slug ? { ...i, qty: Math.max(0, Math.min(20, qty)) } : i)).filter((i) => i.qty > 0);
  saveCart({ ...cart });
}
export function setCartField(field, value) {
  saveCart({ ...getCart(), [field]: value });
}
export function clearCart() {
  saveCart(emptyCart());
}

/* ---------- auth ---------- */
export function getAuth() {
  return read(AUTH_KEY, null);
}
export function setAuth(auth) {
  write(AUTH_KEY, auth);
  window.dispatchEvent(new CustomEvent("auth:change", { detail: auth }));
}
export function clearAuth() {
  setAuth(null);
}

/* ---------- recent orders (guests can find their references again) ---------- */
const RECENT_KEY = "fw-recent-orders";
export function recentOrders() {
  return read(RECENT_KEY, []);
}
export function rememberOrder(ref) {
  write(RECENT_KEY, [ref, ...recentOrders().filter((r) => r !== ref)].slice(0, 10));
}
