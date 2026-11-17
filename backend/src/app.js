const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const config = require("./lib/config");
const { createBaseApp, writeLimiter } = require("./lib/base");
const { hashPassword, checkPassword, signToken, optionalAuth, requireUser, requireAdmin } = require("./lib/auth");
const { HttpError, validate, notFound, errorHandler } = require("./lib/errors");
const { Restaurant, Dish, Order, User, Review, Promo, Subscriber, Message, Upload } = require("./models");
const catalog = require("../shared/catalog.mjs");

const { CATEGORIES, CATEGORY_LABELS, ORDER_STATUSES, STATUS_LABELS, SORTS, FREE_DELIVERY_FROM } = catalog;

/* ---------- validation schemas ---------- */
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits and dashes").min(2).max(60);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const imageRef = z
  .string()
  .trim()
  .min(1, "Add an image")
  .max(300)
  .refine((s) => /^images\/(cutouts\/)?[a-z0-9-]+\.(webp|jpg|png)$/.test(s) || /^https?:\/\/\S+$/.test(s), "Use images/name.webp or a full image URL");
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);
const bool = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);

const restaurantSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  chef: z.string().trim().max(60).optional(),
  cuisines: z.array(z.enum(CATEGORIES)).min(1, "Pick at least one cuisine").max(7),
  priceLevel: z.coerce.number().int().min(1).max(3),
  rating: z.coerce.number().min(0).max(5).optional(),
  ratingCount: z.coerce.number().int().min(0).optional(),
  deliveryTime: z.coerce.number().int().min(5).max(120),
  deliveryFee: z.coerce.number().min(0).max(20),
  address: z.string().trim().max(160).optional(),
  image: imageRef,
  alt: z.string().trim().max(160).optional(),
  discount: z.coerce.number().int().min(0).max(90).optional(),
  fast: bool.optional(),
  opensAt: hhmm,
  closesAt: hhmm,
  order: z.coerce.number().int().optional(),
});

const dishSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  restaurant: slug,
  price: z.coerce.number().min(0.5).max(500),
  cat: z.enum(CATEGORIES),
  image: imageRef,
  alt: z.string().trim().max(160).optional(),
  popular: bool.optional(),
  featured: bool.optional(),
  cutout: z.union([imageRef, z.literal("")]).optional(),
  headline: z.array(z.string().trim().max(30)).max(2).optional(),
  ingredients: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #F17228").optional(),
  chef: z.string().trim().max(60).optional(),
  available: bool.optional(),
  order: z.coerce.number().int().optional(),
});

const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "3-20 letters, digits, - or _"),
  type: z.enum(["percent", "fixed", "free_delivery"]),
  value: z.coerce.number().min(0).max(100).default(0),
  minSubtotal: z.coerce.number().min(0).max(1000).default(0),
  description: z.string().trim().max(120).optional(),
  active: bool.optional(),
  expiresAt: z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => v || null),
  maxUses: z.coerce.number().int().min(0).optional(),
});

const phone = z.string().trim().regex(/^[+]?[0-9 ()-]{7,20}$/, "Enter a valid phone number");
const orderSchema = z
  .object({
    items: z
      .array(z.object({ dish: slug, qty: z.coerce.number().int().min(1).max(20) }))
      .min(1, "Your cart is empty")
      .max(30),
    mode: z.enum(["delivery", "pickup"]),
    name: z.string().trim().min(2, "Enter your name").max(60),
    phone,
    email: z.union([email, z.literal("")]).optional().default(""),
    address: z.string().trim().max(160).optional().default(""),
    note: z.string().trim().max(300).optional().default(""),
    promoCode: z.string().trim().toUpperCase().max(20).optional().default(""),
    payment: z.enum(["card_demo", "cash"]).default("card_demo"),
  })
  .refine((o) => o.mode === "pickup" || o.address.length >= 5, { path: ["address"], message: "Enter a delivery address (at least 5 characters)" });

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  email,
  password: z.string().min(8, "Use at least 8 characters").max(100),
});
const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(100) });
const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional().default("") });
const newsletterSchema = z.object({ email });
const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  email,
  topic: z.enum(["order", "partner", "feedback", "other"]).default("other"),
  message: z.string().trim().min(10, "Write at least 10 characters").max(2000),
});
const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });
const promoCheckSchema = z.object({ code: z.string().trim().toUpperCase().min(1).max(20), subtotal: z.coerce.number().min(0).max(10000) });

/* ---------- helpers ---------- */
const lean = (docs) => docs.map((d) => d.toJSON());
const oneOr404 = (doc, what) => {
  if (!doc) throw new HttpError(404, `${what} not found`);
  return doc;
};

function publicOrder(o) {
  const status = catalog.simulatedStatus(o);
  return {
    reference: o.reference,
    status,
    statusLabel: STATUS_LABELS[status],
    steps: catalog.statusSteps(o.mode),
    mode: o.mode,
    items: o.items.map(({ dish, name, restaurant, restaurantName, price, qty }) => ({ dish, name, restaurant, restaurantName, price, qty })),
    promoCode: o.promoCode,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    payment: o.payment,
    createdAt: o.createdAt,
  };
}

// Rating = seeded rating blended with reviews written on this site.
async function refreshRating(slugValue) {
  const r = await Restaurant.findOne({ slug: slugValue });
  if (!r) return;
  const [agg] = await Review.aggregate([{ $match: { restaurant: slugValue, user: { $exists: true } } }, { $group: { _id: null, sum: { $sum: "$rating" }, n: { $sum: 1 } } }]);
  const baseCount = r.baseCount ?? r.ratingCount;
  const baseRating = r.baseRating ?? r.rating;
  r.baseCount = baseCount;
  r.baseRating = baseRating;
  const n = agg ? agg.n : 0;
  const sum = agg ? agg.sum : 0;
  r.ratingCount = baseCount + n;
  r.rating = Math.round(((baseRating * baseCount + sum) / Math.max(1, baseCount + n)) * 10) / 10;
  await r.save();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 800 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (["image/webp", "image/jpeg", "image/png", "image/avif"].includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, "Upload a WebP, JPEG, PNG or AVIF image"));
  },
});

function createApp() {
  const app = createBaseApp();
  const api = express.Router();

  /* ----- catalogue ----- */
  api.get("/meta", (_req, res) => {
    res.json({ categories: CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })), sorts: SORTS, freeDeliveryFrom: FREE_DELIVERY_FROM, statuses: STATUS_LABELS });
  });

  api.get("/restaurants", async (req, res) => {
    const [restaurants, dishes] = await Promise.all([Restaurant.find().lean({ virtuals: false }), req.query.q ? Dish.find({ available: true }).lean() : []]);
    const rows = catalog.searchRestaurants(
      restaurants.map(({ _id, __v, baseCount, baseRating, ...r }) => ({ id: String(_id), ...r })),
      dishes,
      req.query
    );
    res.json(rows);
  });

  api.get("/restaurants/:slug", async (req, res) => {
    const r = oneOr404(await Restaurant.findOne({ slug: String(req.params.slug) }), "Restaurant");
    const [dishes, reviews] = await Promise.all([
      Dish.find({ restaurant: r.slug, available: true }).sort({ order: 1, name: 1 }),
      Review.find({ restaurant: r.slug }).sort({ createdAt: -1 }).limit(30),
    ]);
    res.json({ ...r.toJSON(), openNow: catalog.isOpenNow(r), dishes: lean(dishes), reviews: lean(reviews).map(({ user, ...rv }) => ({ ...rv, userId: user ? String(user) : null })) });
  });

  api.get("/restaurants/:slug/reviews", async (req, res) => {
    res.json(lean(await Review.find({ restaurant: String(req.params.slug) }).sort({ createdAt: -1 }).limit(50)));
  });

  api.post("/restaurants/:slug/reviews", writeLimiter(30), requireUser, validate(reviewSchema), async (req, res) => {
    const r = oneOr404(await Restaurant.findOne({ slug: String(req.params.slug) }), "Restaurant");
    const user = oneOr404(await User.findById(req.auth.sub), "User");
    const review = await Review.findOneAndUpdate(
      { restaurant: r.slug, user: user._id },
      { rating: req.body.rating, comment: req.body.comment, authorName: user.name },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await refreshRating(r.slug);
    res.status(201).json(review);
  });

  api.get("/dishes", async (req, res) => {
    const rows = await Dish.find({ available: true }).sort({ order: 1, name: 1 });
    res.json(catalog.filterDishes(lean(rows), { ...req.query, popular: req.query.popular === "true", featured: req.query.featured === "true" }));
  });

  // Likes on the orbit menu: anonymous, rate-limited; the browser remembers what it liked.
  api.post("/dishes/:slug/like", writeLimiter(60), validate(z.object({ action: z.enum(["like", "unlike"]) })), async (req, res) => {
    const inc = req.body.action === "like" ? 1 : -1;
    const dish = await Dish.findOneAndUpdate({ slug: String(req.params.slug), ...(inc < 0 ? { likes: { $gt: 0 } } : {}) }, { $inc: { likes: inc } }, { new: true });
    const current = dish || oneOr404(await Dish.findOne({ slug: String(req.params.slug) }), "Dish");
    res.json({ slug: current.slug, likes: current.likes });
  });

  api.get("/dishes/:slug", async (req, res) => {
    res.json(oneOr404(await Dish.findOne({ slug: String(req.params.slug) }), "Dish"));
  });

  api.get("/uploads/:id", async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, "Image not found");
    const file = oneOr404(await Upload.findById(req.params.id), "Image");
    res.set({ "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" });
    res.send(file.data);
  });

  /* ----- promo codes ----- */
  api.post("/promos/validate", writeLimiter(60), validate(promoCheckSchema), async (req, res) => {
    const promo = await Promo.findOne({ code: req.body.code });
    const problem = catalog.promoProblem(promo, req.body.subtotal);
    if (problem) throw new HttpError(400, problem, [{ field: "promoCode", message: problem }]);
    res.json({ code: promo.code, type: promo.type, value: promo.value, minSubtotal: promo.minSubtotal, description: promo.description });
  });

  /* ----- orders ----- */
  api.post("/orders", writeLimiter(20), optionalAuth, validate(orderSchema), async (req, res) => {
    const o = req.body;
    const qty = new Map();
    o.items.forEach((i) => qty.set(i.dish, Math.min(20, (qty.get(i.dish) || 0) + i.qty)));
    const dishes = await Dish.find({ slug: { $in: [...qty.keys()] }, available: true });
    const missing = [...qty.keys()].filter((s) => !dishes.some((d) => d.slug === s));
    if (missing.length) throw new HttpError(400, "Validation failed", [{ field: "items", message: `No longer available: ${missing.join(", ")}` }]);
    const restaurants = await Restaurant.find({ slug: { $in: [...new Set(dishes.map((d) => d.restaurant))] } }).lean();

    let promo = null;
    if (o.promoCode) {
      promo = await Promo.findOne({ code: o.promoCode });
      if (!promo) throw new HttpError(400, "Validation failed", [{ field: "promoCode", message: "This promo code does not exist or is no longer active" }]);
    }
    const items = dishes.map((d) => ({ dish: d.slug, name: d.name, restaurant: d.restaurant, restaurantName: d.restaurantName, price: d.price, qty: qty.get(d.slug) }));
    const price = catalog.priceOrder({ lines: items, mode: o.mode, restaurants, promo });
    if (price.promoError) throw new HttpError(400, "Validation failed", [{ field: "promoCode", message: price.promoError }]);

    const order = await Order.create({
      reference: "FW-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
      user: req.auth?.sub,
      items,
      mode: o.mode,
      customer: { name: o.name, phone: o.phone, email: o.email, address: o.mode === "delivery" ? o.address : "" },
      note: o.note,
      promoCode: promo ? promo.code : "",
      payment: o.payment,
      subtotal: price.subtotal,
      discount: price.discount,
      deliveryFee: price.deliveryFee,
      total: price.total,
    });
    if (promo) await Promo.updateOne({ _id: promo._id }, { $inc: { uses: 1 } });
    res.status(201).json(publicOrder(order));
  });

  // Public tracking by reference: no personal data in the answer.
  api.get("/orders/:reference", async (req, res) => {
    const order = oneOr404(await Order.findOne({ reference: String(req.params.reference).toUpperCase().trim() }), "Order");
    res.json(publicOrder(order));
  });

  /* ----- newsletter + contact ----- */
  api.post("/newsletter", writeLimiter(10), validate(newsletterSchema), async (req, res) => {
    const exists = await Subscriber.exists({ email: req.body.email });
    if (!exists) await Subscriber.create({ email: req.body.email });
    res.status(exists ? 200 : 201).json({ ok: true, message: exists ? "You are already subscribed." : "Thanks! You are subscribed." });
  });

  api.post("/contact", writeLimiter(10), validate(contactSchema), async (req, res) => {
    await Message.create(req.body);
    res.status(201).json({ ok: true, message: "Thanks, we got your message and will reply within one working day." });
  });

  /* ----- accounts ----- */
  api.post("/auth/register", writeLimiter(10), validate(registerSchema), async (req, res) => {
    if (await User.exists({ email: req.body.email })) throw new HttpError(409, "An account with this email already exists", [{ field: "email", message: "An account with this email already exists" }]);
    const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await hashPassword(req.body.password) });
    res.status(201).json({ token: signToken(user), user });
  });

  api.post("/auth/login", writeLimiter(15), validate(loginSchema), async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await checkPassword(req.body.password, user.passwordHash))) throw new HttpError(401, "Wrong email or password");
    res.json({ token: signToken(user), user });
  });

  api.get("/auth/me", requireUser, async (req, res) => {
    res.json(oneOr404(await User.findById(req.auth.sub), "User"));
  });

  api.get("/me/orders", requireUser, async (req, res) => {
    const rows = await Order.find({ user: req.auth.sub }).sort({ createdAt: -1 }).limit(50);
    res.json(rows.map(publicOrder));
  });

  api.get("/me/favourites", requireUser, async (req, res) => {
    const user = oneOr404(await User.findById(req.auth.sub), "User");
    const rows = await Restaurant.find({ slug: { $in: user.favourites } });
    res.json(lean(rows).map((r) => ({ ...r, openNow: catalog.isOpenNow(r) })));
  });

  api.put("/me/favourites/:slug", requireUser, async (req, res) => {
    oneOr404(await Restaurant.exists({ slug: String(req.params.slug) }), "Restaurant");
    const user = await User.findByIdAndUpdate(req.auth.sub, { $addToSet: { favourites: String(req.params.slug) } }, { new: true });
    res.json({ favourites: oneOr404(user, "User").favourites });
  });

  api.delete("/me/favourites/:slug", requireUser, async (req, res) => {
    const user = await User.findByIdAndUpdate(req.auth.sub, { $pull: { favourites: String(req.params.slug) } }, { new: true });
    res.json({ favourites: oneOr404(user, "User").favourites });
  });

  /* ----- admin ----- */
  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get("/stats", async (_req, res) => {
    const [orders, revenue, restaurants, dishes, users, subscribers, messages] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, sum: { $sum: "$total" } } }]),
      Restaurant.countDocuments(),
      Dish.countDocuments(),
      User.countDocuments(),
      Subscriber.countDocuments(),
      Message.countDocuments({ handled: false }),
    ]);
    res.json({ orders, revenue: catalog.round2(revenue[0]?.sum || 0), restaurants, dishes, users, subscribers, openMessages: messages });
  });

  admin.get("/orders", async (req, res) => {
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const rows = await Order.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(rows.map((o) => ({ ...o.toJSON(), status: catalog.simulatedStatus(o) })));
  });

  admin.patch("/orders/:reference", validate(statusSchema), async (req, res) => {
    const order = await Order.findOneAndUpdate({ reference: String(req.params.reference).toUpperCase() }, { status: req.body.status, manualStatus: true }, { new: true });
    res.json(oneOr404(order, "Order"));
  });

  admin.delete("/orders/:reference", async (req, res) => {
    oneOr404(await Order.findOneAndDelete({ reference: String(req.params.reference).toUpperCase() }), "Order");
    res.status(204).end();
  });

  admin.post("/restaurants", validate(restaurantSchema), async (req, res) => {
    const body = { ...req.body, baseRating: req.body.rating ?? 0, baseCount: req.body.ratingCount ?? 0 };
    res.status(201).json(await Restaurant.create(body));
  });

  admin.put("/restaurants/:slug", validate(restaurantSchema.partial()), async (req, res) => {
    const update = { ...req.body };
    if (update.rating != null) update.baseRating = update.rating;
    if (update.ratingCount != null) update.baseCount = update.ratingCount;
    const r = oneOr404(await Restaurant.findOneAndUpdate({ slug: String(req.params.slug) }, update, { new: true, runValidators: true }), "Restaurant");
    if (update.slug && update.slug !== req.params.slug) {
      await Dish.updateMany({ restaurant: req.params.slug }, { restaurant: r.slug });
      await Review.updateMany({ restaurant: req.params.slug }, { restaurant: r.slug });
    }
    if (update.name || update.slug) await Dish.updateMany({ restaurant: r.slug }, { restaurantName: r.name });
    res.json(r);
  });

  admin.delete("/restaurants/:slug", async (req, res) => {
    if (await Dish.exists({ restaurant: String(req.params.slug) })) throw new HttpError(409, "Delete or move this restaurant's dishes first");
    oneOr404(await Restaurant.findOneAndDelete({ slug: String(req.params.slug) }), "Restaurant");
    await Review.deleteMany({ restaurant: String(req.params.slug) });
    res.status(204).end();
  });

  admin.get("/dishes", async (_req, res) => {
    res.json(await Dish.find().sort({ restaurant: 1, order: 1, name: 1 }));
  });

  const restaurantFor = async (slugValue) => {
    const r = await Restaurant.findOne({ slug: slugValue });
    if (!r) throw new HttpError(400, "Validation failed", [{ field: "restaurant", message: "Unknown restaurant" }]);
    return r;
  };

  admin.post("/dishes", validate(dishSchema), async (req, res) => {
    const r = await restaurantFor(req.body.restaurant);
    res.status(201).json(await Dish.create({ ...req.body, restaurantName: r.name }));
  });

  admin.put("/dishes/:slug", validate(dishSchema.partial()), async (req, res) => {
    const update = { ...req.body };
    if (update.restaurant) update.restaurantName = (await restaurantFor(update.restaurant)).name;
    res.json(oneOr404(await Dish.findOneAndUpdate({ slug: String(req.params.slug) }, update, { new: true, runValidators: true }), "Dish"));
  });

  admin.delete("/dishes/:slug", async (req, res) => {
    oneOr404(await Dish.findOneAndDelete({ slug: String(req.params.slug) }), "Dish");
    res.status(204).end();
  });

  admin.get("/promos", async (_req, res) => res.json(await Promo.find().sort({ createdAt: -1 })));

  admin.post("/promos", validate(promoSchema), async (req, res) => {
    res.status(201).json(await Promo.create(req.body));
  });

  admin.put("/promos/:code", validate(promoSchema.partial()), async (req, res) => {
    res.json(oneOr404(await Promo.findOneAndUpdate({ code: String(req.params.code).toUpperCase() }, req.body, { new: true, runValidators: true }), "Promo code"));
  });

  admin.delete("/promos/:code", async (req, res) => {
    oneOr404(await Promo.findOneAndDelete({ code: String(req.params.code).toUpperCase() }), "Promo code");
    res.status(204).end();
  });

  admin.get("/messages", async (_req, res) => res.json(await Message.find().sort({ createdAt: -1 }).limit(200)));

  admin.patch("/messages/:id", validate(z.object({ handled: z.boolean() })), async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, "Message not found");
    res.json(oneOr404(await Message.findByIdAndUpdate(req.params.id, { handled: req.body.handled }, { new: true }), "Message"));
  });

  admin.get("/subscribers", async (_req, res) => res.json(await Subscriber.find().sort({ createdAt: -1 }).limit(500)));

  admin.post("/uploads", upload.single("image"), async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose an image file (field name: image)");
    const file = await Upload.create({ contentType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
    const base = config.publicUrl || `${req.protocol}://${req.get("host")}`;
    res.status(201).json({ id: String(file._id), url: `${base}/api/uploads/${file._id}`, size: file.size });
  });

  api.use("/admin", admin);
  app.use("/api", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, isOpenNow: catalog.isOpenNow };
