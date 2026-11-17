const crypto = require("crypto");
const express = require("express");
const { z } = require("zod");
const { createBaseApp, publicWriteLimiter } = require("./lib/base");
const { requireAdmin } = require("./lib/auth");
const { HttpError, validate, notFound, errorHandler } = require("./lib/errors");
const { CATEGORIES, ORDER_STATUSES, Restaurant, Dish, Order } = require("./models");

const DELIVERY_FEE = 2.5;
const FREE_DELIVERY_FROM = 30;
const round2 = (n) => Math.round(n * 100) / 100;
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits and dashes").max(60);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const restaurantSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(60),
  image: z.string().trim().min(1).max(200),
  alt: z.string().trim().max(160).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  discount: z.coerce.number().int().min(0).max(90).optional(),
  fast: z.boolean().optional(),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  order: z.coerce.number().int().optional(),
});

const dishSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(60),
  restaurant: slug,
  price: z.coerce.number().min(0.5).max(500),
  cat: z.enum(CATEGORIES),
  img: slug,
  alt: z.string().trim().max(160).optional(),
  available: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
});

const orderSchema = z
  .object({
    items: z
      .array(z.object({ dish: slug, qty: z.coerce.number().int().min(1).max(20) }))
      .min(1, "Add at least one dish")
      .max(30),
    mode: z.enum(["delivery", "pickup"]),
    name: z.string().trim().min(2, "Enter your name").max(60),
    phone: z.string().trim().regex(/^[+]?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
    address: z.string().trim().max(160).optional().default(""),
    note: z.string().trim().max(300).optional().default(""),
  })
  .refine((o) => o.mode === "pickup" || o.address.length >= 5, { path: ["address"], message: "Enter a delivery address (at least 5 characters)" });

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

// Opening hours are in Baku time; "00:00" as closing time means midnight.
function isOpenNow(r, now = new Date()) {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const close = r.closesAt === "00:00" ? "24:00" : r.closesAt;
  return hm >= r.opensAt && hm < close;
}

function createApp() {
  const app = createBaseApp();
  const api = express.Router();

  /* ----- Public menu ----- */
  api.get("/restaurants", async (_req, res) => {
    const rows = await Restaurant.find().sort({ order: 1, name: 1 });
    res.json(rows.map((r) => ({ ...r.toJSON(), openNow: isOpenNow(r) })));
  });

  api.get("/dishes", async (req, res) => {
    const filter = { available: true };
    if (req.query.cat && req.query.cat !== "all") filter.cat = String(req.query.cat);
    if (req.query.restaurant) filter.restaurant = String(req.query.restaurant);
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 50)), "i");
      filter.$or = [{ name: rx }, { restaurantName: rx }];
    }
    res.json(await Dish.find(filter).sort({ order: 1, name: 1 }));
  });

  api.get("/dishes/:slug", async (req, res) => {
    const dish = await Dish.findOne({ slug: String(req.params.slug) });
    if (!dish) throw new HttpError(404, "Dish not found");
    res.json(dish);
  });

  /* ----- Orders ----- */
  api.post("/orders", publicWriteLimiter(), validate(orderSchema), async (req, res) => {
    const o = req.body;
    // merge duplicate lines, then price everything on the server
    const qty = new Map();
    o.items.forEach((i) => qty.set(i.dish, Math.min(20, (qty.get(i.dish) || 0) + i.qty)));
    const dishes = await Dish.find({ slug: { $in: [...qty.keys()] }, available: true });
    const missing = [...qty.keys()].filter((s) => !dishes.some((d) => d.slug === s));
    if (missing.length) throw new HttpError(400, "Validation failed", [{ field: "items", message: `Not available: ${missing.join(", ")}` }]);

    const items = dishes.map((d) => ({ dish: d.slug, name: d.name, restaurantName: d.restaurantName, price: d.price, qty: qty.get(d.slug) }));
    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const deliveryFee = o.mode === "delivery" && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
    const order = await Order.create({
      reference: "FW-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
      items,
      mode: o.mode,
      customer: { name: o.name, phone: o.phone, address: o.mode === "delivery" ? o.address : "" },
      note: o.note,
      subtotal,
      deliveryFee,
      total: round2(subtotal + deliveryFee),
    });
    res.status(201).json(publicOrder(order));
  });

  // Public tracking by reference: no personal data in the answer.
  api.get("/orders/:reference", async (req, res) => {
    const order = await Order.findOne({ reference: String(req.params.reference).toUpperCase() });
    if (!order) throw new HttpError(404, "Order not found");
    res.json(publicOrder(order));
  });

  /* ----- Admin (JWT) ----- */
  api.get("/admin/orders", requireAdmin, async (req, res) => {
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  });

  api.patch("/admin/orders/:reference", requireAdmin, validate(statusSchema), async (req, res) => {
    const order = await Order.findOneAndUpdate({ reference: String(req.params.reference).toUpperCase() }, { status: req.body.status }, { new: true });
    if (!order) throw new HttpError(404, "Order not found");
    res.json(order);
  });

  api.post("/admin/dishes", requireAdmin, validate(dishSchema), async (req, res) => {
    const rest = await Restaurant.findOne({ slug: req.body.restaurant });
    if (!rest) throw new HttpError(400, "Validation failed", [{ field: "restaurant", message: "Unknown restaurant" }]);
    res.status(201).json(await Dish.create({ ...req.body, restaurantName: rest.name }));
  });

  api.put("/admin/dishes/:slug", requireAdmin, validate(dishSchema.partial()), async (req, res) => {
    const update = { ...req.body };
    if (update.restaurant) {
      const rest = await Restaurant.findOne({ slug: update.restaurant });
      if (!rest) throw new HttpError(400, "Validation failed", [{ field: "restaurant", message: "Unknown restaurant" }]);
      update.restaurantName = rest.name;
    }
    const dish = await Dish.findOneAndUpdate({ slug: String(req.params.slug) }, update, { new: true, runValidators: true });
    if (!dish) throw new HttpError(404, "Dish not found");
    res.json(dish);
  });

  api.delete("/admin/dishes/:slug", requireAdmin, async (req, res) => {
    const dish = await Dish.findOneAndDelete({ slug: String(req.params.slug) });
    if (!dish) throw new HttpError(404, "Dish not found");
    res.status(204).end();
  });

  api.post("/admin/restaurants", requireAdmin, validate(restaurantSchema), async (req, res) => {
    res.status(201).json(await Restaurant.create(req.body));
  });

  api.put("/admin/restaurants/:slug", requireAdmin, validate(restaurantSchema.partial()), async (req, res) => {
    const rest = await Restaurant.findOneAndUpdate({ slug: String(req.params.slug) }, req.body, { new: true, runValidators: true });
    if (!rest) throw new HttpError(404, "Restaurant not found");
    if (req.body.name) await Dish.updateMany({ restaurant: rest.slug }, { restaurantName: rest.name });
    res.json(rest);
  });

  api.delete("/admin/restaurants/:slug", requireAdmin, async (req, res) => {
    if (await Dish.exists({ restaurant: String(req.params.slug) })) throw new HttpError(409, "Delete or move this restaurant's dishes first");
    const rest = await Restaurant.findOneAndDelete({ slug: String(req.params.slug) });
    if (!rest) throw new HttpError(404, "Restaurant not found");
    res.status(204).end();
  });

  app.use("/api", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function publicOrder(o) {
  return {
    reference: o.reference,
    status: o.status,
    mode: o.mode,
    items: o.items.map(({ dish, name, price, qty }) => ({ dish, name, price, qty })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    createdAt: o.createdAt,
  };
}

module.exports = { createApp, isOpenNow };
