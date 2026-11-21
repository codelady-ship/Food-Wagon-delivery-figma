// API tests on an in-memory MongoDB (supertest + node:test). Run: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.CORS_ORIGINS = "http://allowed.test";

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const { createApp } = require("../src/app");
const { seed } = require("../src/seed");
const catalog = require("../shared/catalog.mjs");

let mongo;
let app;
let adminToken;
let userToken;
let reference;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("fw-test"));
  await seed();
  app = createApp();
  adminToken = (await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" })).body.token;
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const asAdmin = (req) => req.set("Authorization", `Bearer ${adminToken}`);
const asUser = (req) => req.set("Authorization", `Bearer ${userToken}`);

test("health, security headers and CORS allow-list", async () => {
  const res = await request(app).get("/api/health").set("Origin", "http://allowed.test");
  assert.equal(res.status, 200);
  assert.equal(res.body.db, "up");
  assert.equal(res.headers["access-control-allow-origin"], "http://allowed.test");
  assert.ok(res.headers["x-content-type-options"]); // helmet
  assert.equal((await request(app).get("/api/health").set("Origin", "http://evil.test")).status, 403);
  assert.equal((await request(app).get("/api/nope")).status, 404);
});

test("restaurants: search, filters and sorting", async () => {
  const all = await request(app).get("/api/restaurants");
  assert.equal(all.body.length, 8);
  assert.equal(typeof all.body[0].openNow, "boolean");
  assert.equal(all.body[0].baseCount, undefined);

  const italian = await request(app).get("/api/restaurants?cuisine=italian");
  assert.ok(italian.body.length >= 2 && italian.body.every((r) => r.cuisines.includes("italian")));

  const cheap = await request(app).get("/api/restaurants?price=1&sort=rating");
  assert.ok(cheap.body.every((r) => r.priceLevel === 1));
  assert.deepEqual(cheap.body.map((r) => r.rating), [...cheap.body.map((r) => r.rating)].sort((a, b) => b - a));

  const fast = await request(app).get("/api/restaurants?maxDelivery=20&minRating=4.3");
  assert.ok(fast.body.length >= 1 && fast.body.every((r) => r.deliveryTime <= 20 && r.rating >= 4.3));

  const byDish = await request(app).get("/api/restaurants?q=ramen");
  assert.ok(byDish.body.some((r) => r.slug === "tokyo-noodle-bar")); // matched through a dish name

  const open = await request(app).get("/api/restaurants?openNow=true");
  assert.ok(open.body.every((r) => r.openNow));
  assert.equal((await request(app).get("/api/restaurants?q=(((")).status, 200);
});

test("restaurant detail, dishes and meta", async () => {
  const r = await request(app).get("/api/restaurants/golden-fork-bistro");
  assert.equal(r.status, 200);
  assert.ok(r.body.dishes.length >= 3 && r.body.reviews.length >= 1);
  assert.equal((await request(app).get("/api/restaurants/nope")).status, 404);
  const asian = await request(app).get("/api/dishes?cat=asian");
  assert.ok(asian.body.length >= 3 && asian.body.every((d) => d.cat === "asian"));
  const popular = await request(app).get("/api/dishes?popular=true");
  assert.ok(popular.body.every((d) => d.popular));
  assert.equal((await request(app).get("/api/dishes/veggie-pizza")).body.price, 12.5);
  assert.equal((await request(app).get("/api/meta")).body.categories.length, 8);
  const featured = await request(app).get("/api/dishes?featured=true");
  assert.equal(featured.body.length, 6);
  assert.ok(featured.body.every((d) => d.cutout && d.headline.length === 2 && d.ingredients.length && /^#/.test(d.accent) && d.chef));
});

test("opening hours helper handles midnight", () => {
  const late = { opensAt: "11:00", closesAt: "02:00" };
  assert.equal(catalog.isOpenNow(late, new Date("2026-01-01T21:00:00Z")), true); // 01:00 Baku
  assert.equal(catalog.isOpenNow(late, new Date("2026-01-01T02:00:00Z")), false); // 06:00 Baku
  const mid = { opensAt: "10:00", closesAt: "00:00" };
  assert.equal(catalog.isOpenNow(mid, new Date("2026-01-01T19:30:00Z")), true); // 23:30 Baku
});

test("auth: register, login, me, validation", async () => {
  const bad = await request(app).post("/api/auth/register").send({ name: "A", email: "x", password: "123" });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.details.some((d) => d.field === "password"));

  const reg = await request(app).post("/api/auth/register").send({ name: "Test User", email: "User@Test.local", password: "secret123" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.equal(reg.body.user.passwordHash, undefined);
  assert.equal(reg.body.user.role, "user");
  assert.equal((await request(app).post("/api/auth/register").send({ name: "Again", email: "user@test.local", password: "secret123" })).status, 409);
  assert.equal((await request(app).post("/api/auth/login").send({ email: "user@test.local", password: "wrong-pass" })).status, 401);

  const login = await request(app).post("/api/auth/login").send({ email: "user@test.local", password: "secret123" });
  userToken = login.body.token;
  const me = await asUser(request(app).get("/api/auth/me"));
  assert.equal(me.body.email, "user@test.local");
  assert.equal((await request(app).get("/api/auth/me")).status, 401);
  assert.equal((await request(app).get("/api/auth/me").set("Authorization", "Bearer broken")).status, 401);
});

test("promo codes", async () => {
  const ok = await request(app).post("/api/promos/validate").send({ code: "welcome10", subtotal: 20 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.type, "percent");
  assert.equal((await request(app).post("/api/promos/validate").send({ code: "WELCOME10", subtotal: 5 })).status, 400);
  assert.equal((await request(app).post("/api/promos/validate").send({ code: "NOPE", subtotal: 50 })).status, 400);
});

test("orders: server-side pricing, promo, tracking", async () => {
  const res = await asUser(request(app).post("/api/orders")).send({
    items: [{ dish: "veggie-pizza", qty: 1, price: 0.01 }, { dish: "fresh-orange-juice", qty: 2 }, { dish: "veggie-pizza", qty: 1 }],
    mode: "delivery",
    name: "Test Customer",
    phone: "+994 50 000 00 00",
    address: "Nizami street 10, Baku",
    promoCode: "welcome10",
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.reference, /^FW-[0-9A-F]{6}$/);
  assert.equal(res.body.subtotal, 32.8); // 2 x 12.5 + 2 x 3.9, client price ignored
  assert.equal(res.body.discount, 3.28);
  assert.equal(res.body.deliveryFee, 0); // free from $30
  assert.equal(res.body.total, 29.52);
  assert.equal(res.body.status, "received");
  reference = res.body.reference;

  const small = await request(app).post("/api/orders").send({ items: [{ dish: "morning-juice", qty: 1 }], mode: "delivery", name: "Guest", phone: "+994 55 111 22 33", address: "Some street 1" });
  assert.equal(small.body.deliveryFee, 1);

  const badPromo = await request(app).post("/api/orders").send({ items: [{ dish: "morning-juice", qty: 1 }], mode: "pickup", name: "Guest", phone: "+994 55 111 22 33", promoCode: "BIG5" });
  assert.equal(badPromo.status, 400);
  assert.equal(badPromo.body.details[0].field, "promoCode");

  const noAddress = await request(app).post("/api/orders").send({ items: [{ dish: "veggie-pizza", qty: 1 }], mode: "delivery", name: "Guest", phone: "+994 55 111 22 33" });
  assert.equal(noAddress.status, 400);
  assert.equal((await request(app).post("/api/orders").send({ items: [{ dish: "ghost-dish", qty: 1 }], mode: "pickup", name: "Guest", phone: "+994 55 111 22 33" })).status, 400);

  const track = await request(app).get(`/api/orders/${reference.toLowerCase()}`);
  assert.equal(track.status, 200);
  assert.deepEqual(track.body.steps, ["received", "preparing", "on_the_way", "delivered"]);
  assert.equal(track.body.customer, undefined); // no personal data in public tracking

  const mine = await asUser(request(app).get("/api/me/orders"));
  assert.equal(mine.body.length, 1);
});

test("status simulation moves forward over time", () => {
  const createdAt = new Date("2026-01-01T10:00:00Z");
  assert.equal(catalog.simulatedStatus({ mode: "delivery", status: "received", createdAt }, new Date("2026-01-01T10:05:00Z")), "on_the_way");
  assert.equal(catalog.simulatedStatus({ mode: "delivery", status: "preparing", manualStatus: true, createdAt }, new Date("2026-01-01T11:00:00Z")), "preparing");
});

test("favourites and reviews", async () => {
  assert.equal((await request(app).put("/api/me/favourites/napoli-slice")).status, 401);
  const fav = await asUser(request(app).put("/api/me/favourites/napoli-slice"));
  assert.deepEqual(fav.body.favourites, ["napoli-slice"]);
  assert.equal((await asUser(request(app).get("/api/me/favourites"))).body[0].slug, "napoli-slice");
  assert.equal((await asUser(request(app).put("/api/me/favourites/nope"))).status, 404);
  assert.deepEqual((await asUser(request(app).delete("/api/me/favourites/napoli-slice"))).body.favourites, []);

  const before = (await request(app).get("/api/restaurants/napoli-slice")).body;
  const review = await asUser(request(app).post("/api/restaurants/napoli-slice/reviews")).send({ rating: 5, comment: "Crispy and hot." });
  assert.equal(review.status, 201);
  await asUser(request(app).post("/api/restaurants/napoli-slice/reviews")).send({ rating: 5, comment: "Updated review." }); // upsert, not duplicate
  const afterR = (await request(app).get("/api/restaurants/napoli-slice")).body;
  assert.equal(afterR.ratingCount, before.ratingCount + 1);
  assert.ok(afterR.rating >= before.rating);
  assert.equal(afterR.reviews.filter((r) => r.authorName === "Test User").length, 1);
  assert.equal((await asUser(request(app).post("/api/restaurants/napoli-slice/reviews")).send({ rating: 9 })).status, 400);
});

test("dish likes", async () => {
  const before = (await request(app).get("/api/dishes/shrimp-ramen")).body.likes;
  assert.equal((await request(app).post("/api/dishes/shrimp-ramen/like").send({ action: "like" })).body.likes, before + 1);
  assert.equal((await request(app).post("/api/dishes/shrimp-ramen/like").send({ action: "unlike" })).body.likes, before);
  assert.equal((await request(app).post("/api/dishes/shrimp-ramen/like").send({ action: "boost" })).status, 400);
  assert.equal((await request(app).post("/api/dishes/ghost/like").send({ action: "like" })).status, 404);
});

test("newsletter and contact", async () => {
  assert.equal((await request(app).post("/api/newsletter").send({ email: "a@b.co" })).status, 201);
  assert.equal((await request(app).post("/api/newsletter").send({ email: "A@b.co" })).status, 200);
  assert.equal((await request(app).post("/api/newsletter").send({ email: "nope" })).status, 400);
  assert.equal((await request(app).post("/api/contact").send({ name: "Ann", email: "ann@x.co", topic: "feedback", message: "Lovely demo site!" })).status, 201);
  assert.equal((await request(app).post("/api/contact").send({ name: "Ann", email: "ann@x.co", message: "short" })).status, 400);
});

test("admin: access control, CRUD, uploads, order status", async () => {
  assert.equal((await request(app).get("/api/admin/orders")).status, 401);
  assert.equal((await asUser(request(app).get("/api/admin/orders"))).status, 403);
  const stats = await asAdmin(request(app).get("/api/admin/stats"));
  assert.equal(stats.body.restaurants, 8);

  const upload = await asAdmin(request(app).post("/api/admin/uploads")).attach("image", Buffer.from("RIFF0000WEBPVP8 "), { filename: "x.webp", contentType: "image/webp" });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  const img = await request(app).get(new URL(upload.body.url).pathname);
  assert.equal(img.headers["content-type"], "image/webp");
  assert.equal((await asAdmin(request(app).post("/api/admin/uploads")).attach("image", Buffer.from("x"), { filename: "x.txt", contentType: "text/plain" })).status, 400);

  const rest = { slug: "test-diner", name: "Test Diner", cuisines: ["burger"], priceLevel: 1, deliveryTime: 15, deliveryFee: 1, image: upload.body.url, opensAt: "00:00", closesAt: "00:00" };
  assert.equal((await asAdmin(request(app).post("/api/admin/restaurants")).send(rest)).status, 201);
  assert.equal((await asAdmin(request(app).post("/api/admin/restaurants")).send(rest)).status, 409);
  assert.equal((await asAdmin(request(app).post("/api/admin/restaurants")).send({ ...rest, slug: "x y", image: "javascript:alert(1)" })).status, 400);

  const dish = { slug: "test-burger", name: "Test Burger", restaurant: "test-diner", price: 7, cat: "burger", image: "images/burger.webp" };
  assert.equal((await asAdmin(request(app).post("/api/admin/dishes")).send(dish)).status, 201);
  assert.equal((await asAdmin(request(app).post("/api/admin/dishes")).send({ ...dish, slug: "orphan", restaurant: "nope" })).status, 400);
  assert.equal((await asAdmin(request(app).put("/api/admin/dishes/test-burger")).send({ price: 8 })).body.price, 8);
  assert.equal((await asAdmin(request(app).put("/api/admin/restaurants/test-diner")).send({ name: "Renamed Diner" })).status, 200);
  assert.equal((await request(app).get("/api/dishes/test-burger")).body.restaurantName, "Renamed Diner");
  assert.equal((await asAdmin(request(app).delete("/api/admin/restaurants/test-diner"))).status, 409);
  assert.equal((await asAdmin(request(app).delete("/api/admin/dishes/test-burger"))).status, 204);
  assert.equal((await asAdmin(request(app).delete("/api/admin/restaurants/test-diner"))).status, 204);

  const promo = await asAdmin(request(app).post("/api/admin/promos")).send({ code: "test20", type: "percent", value: 20, minSubtotal: 0, maxUses: 1 });
  assert.equal(promo.status, 201);
  assert.equal(promo.body.code, "TEST20");
  assert.equal((await asAdmin(request(app).put("/api/admin/promos/TEST20")).send({ active: false })).body.active, false);
  assert.equal((await request(app).post("/api/promos/validate").send({ code: "TEST20", subtotal: 10 })).status, 400);
  assert.equal((await asAdmin(request(app).delete("/api/admin/promos/TEST20"))).status, 204);

  const patched = await asAdmin(request(app).patch(`/api/admin/orders/${reference}`)).send({ status: "on_the_way" });
  assert.equal(patched.body.status, "on_the_way");
  assert.equal((await asAdmin(request(app).patch(`/api/admin/orders/${reference}`)).send({ status: "teleported" })).status, 400);
  assert.equal((await request(app).get(`/api/orders/${reference}`)).body.status, "on_the_way");
  assert.ok((await asAdmin(request(app).get("/api/admin/messages"))).body.length >= 1);
  assert.ok((await asAdmin(request(app).get("/api/admin/subscribers"))).body.length >= 1);
});

test("demo admin: seeded by seed(), can read every admin page, every write answers 403", async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "admin@foodwagon.demo", password: "demo-admin" });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "demo");
  const asDemo = (req) => req.set("Authorization", `Bearer ${login.body.token}`);
  for (const path of ["/stats", "/orders", "/dishes", "/promos", "/messages", "/subscribers"]) {
    assert.equal((await asDemo(request(app).get(`/api/admin${path}`))).status, 200, path);
  }
  const writes = [
    request(app).post("/api/admin/restaurants").send({ slug: "demo-x", name: "Demo X" }),
    request(app).put("/api/admin/dishes/margherita").send({ price: 1 }),
    request(app).delete("/api/admin/promos/WELCOME10"),
    request(app).patch(`/api/admin/orders/${reference}`).send({ status: "cancelled" }),
    request(app).post("/api/admin/uploads").attach("image", Buffer.from("RIFF0000WEBPVP8 "), { filename: "x.webp", contentType: "image/webp" }),
  ];
  for (const req of writes) {
    const res = await asDemo(req);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /read-only/);
  }
  assert.notEqual((await request(app).get(`/api/orders/${reference}`)).body.status, "cancelled");
  // re-seeding keeps the demo account read-only and never touches the real admin
  await seed();
  assert.equal((await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" })).body.user.role, "admin");
});

test("demo admin: no personal data in any admin GET, filters are not an oracle", async () => {
  const { DEMO_VIEWS } = require("../src/lib/demo");
  const secret = { name: "Zarifa Qurbanova", phone: "+994 51 987 65 43", email: "zarifa.private@realmail.test", address: "Hidden Lane 77, flat 12", note: "Gate code 4471", message: "Please call my husband Orkhan back today." };
  const order = await request(app).post("/api/orders").send({ items: [{ dish: "veggie-pizza", qty: 1 }], mode: "delivery", name: secret.name, phone: secret.phone, email: secret.email, address: secret.address, note: secret.note });
  assert.equal(order.status, 201);
  assert.equal((await request(app).post("/api/contact").send({ name: secret.name, email: secret.email, topic: "order", message: secret.message })).status, 201);
  assert.equal((await request(app).post("/api/newsletter").send({ email: secret.email })).status, 201);

  const token = (await request(app).post("/api/auth/login").send({ email: "admin@foodwagon.demo", password: "demo-admin" })).body.token;
  const asDemo = (req) => req.set("Authorization", `Bearer ${token}`);
  // every personal value this test file has written so far, whole and in parts
  const forbidden = [secret.name, "Zarifa", "Qurbanova", secret.phone, "987 65 43", secret.email, "zarifa", "realmail", secret.address, "Hidden Lane", secret.note, "4471", secret.message, "Orkhan", "Test Customer", "+994 50 000 00 00", "Nizami street 10", "+994 55 111 22 33", "Some street 1", "ann@x.co", "a@b.co", "Lovely demo site", "admin@test.local"];
  const paths = Object.keys(DEMO_VIEWS);
  assert.deepEqual([...paths].sort(), ["/dishes", "/messages", "/orders", "/promos", "/stats", "/subscribers"]);
  for (const path of [...paths, "/orders?status=received", "/orders?q=Zarifa&search=Zarifa&sort=customer.name&customer.name=Zarifa", "/messages?email=" + encodeURIComponent(secret.email), "/subscribers?sort=email&q=zarifa"]) {
    const res = await asDemo(request(app).get(`/api/admin${path}`));
    assert.equal(res.status, 200, path);
    const text = JSON.stringify(res.body).toLowerCase();
    for (const value of forbidden) assert.ok(!text.includes(value.toLowerCase()), `${path} leaks "${value}"`);
  }

  // rows are still listed, with placeholders, and unknown query parameters change nothing
  const orders = (await asDemo(request(app).get("/api/admin/orders"))).body;
  const mine = orders.find((o) => o.reference === order.body.reference);
  assert.deepEqual(mine.customer, { name: mine.customer.name, phone: "+000 00 000 00 00", email: mine.customer.email, address: "Hidden in the public demo" });
  assert.match(mine.customer.name, /^Customer \d+$/);
  assert.match(mine.customer.email, /^hidden-\d+@demo\.invalid$/);
  assert.equal(mine.note, "Hidden in the public demo");
  assert.equal(mine.user, undefined);
  assert.equal(mine.total, order.body.total);
  assert.deepEqual((await asDemo(request(app).get("/api/admin/orders?customer.name=Nobody&q=nobody"))).body, orders);
  const messages = (await asDemo(request(app).get("/api/admin/messages"))).body;
  assert.ok(messages.length >= 2 && messages.every((m) => m.message === "Hidden in the public demo" && /^Visitor \d+$/.test(m.name) && /@demo\.invalid$/.test(m.email)));
  const subs = (await asDemo(request(app).get("/api/admin/subscribers"))).body;
  assert.ok(subs.length >= 2 && subs.every((s) => /^hidden-\d+@demo\.invalid$/.test(s.email)));
  assert.equal(new Set(subs.map((s) => s.email)).size, subs.length);

  // an admin GET that is not listed in lib/demo.js is refused for the demo role (deny by default)
  assert.equal((await asDemo(request(app).get("/api/admin/users"))).status, 403);
  assert.equal((await asAdmin(request(app).get("/api/admin/users"))).status, 404);

  // the real admin still sees everything
  const full = (await asAdmin(request(app).get("/api/admin/orders"))).body.find((o) => o.reference === order.body.reference);
  assert.deepEqual({ name: full.customer.name, phone: full.customer.phone, email: full.customer.email, address: full.customer.address, note: full.note }, { name: secret.name, phone: secret.phone, email: secret.email, address: secret.address, note: secret.note });
  assert.ok((await asAdmin(request(app).get("/api/admin/messages"))).body.some((m) => m.message === secret.message && m.email === secret.email));
  assert.ok((await asAdmin(request(app).get("/api/admin/subscribers"))).body.some((s) => s.email === secret.email));
});

test("demo account is shared: it owns no orders and cannot review or save favourites", async () => {
  const { User, Order, Review } = require("../src/models");
  const token = (await request(app).post("/api/auth/login").send({ email: "admin@foodwagon.demo", password: "demo-admin" })).body.token;
  const asDemo = (req) => req.set("Authorization", `Bearer ${token}`);
  const demo = await User.findOne({ role: "demo" });

  const placed = await asDemo(request(app).post("/api/orders")).send({ items: [{ dish: "morning-juice", qty: 1 }], mode: "pickup", name: "Private Visitor", phone: "+994 70 123 45 67" });
  assert.equal(placed.status, 201); // a visitor signed in as demo can still order, as a guest
  assert.equal((await Order.findOne({ reference: placed.body.reference })).user, undefined);
  assert.equal(await Order.countDocuments({ user: demo._id }), 0);
  assert.deepEqual((await asDemo(request(app).get("/api/me/orders"))).body, []);

  // an order attached to the demo account by an older version stays hidden, and is detached on the next seed
  await Order.updateOne({ reference: placed.body.reference }, { user: demo._id });
  assert.deepEqual((await asDemo(request(app).get("/api/me/orders"))).body, []);
  await seed();
  assert.equal(await Order.countDocuments({ user: demo._id }), 0);

  const reviews = await Review.countDocuments();
  for (const req of [
    request(app).post("/api/restaurants/napoli-slice/reviews").send({ rating: 1, comment: "spam" }),
    request(app).put("/api/me/favourites/napoli-slice"),
    request(app).delete("/api/me/favourites/napoli-slice"),
  ]) {
    const res = await asDemo(req);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /read-only/);
  }
  assert.equal(await Review.countDocuments(), reviews);
  assert.deepEqual([...(await User.findById(demo._id)).favourites], []);
  assert.deepEqual((await asDemo(request(app).get("/api/me/favourites"))).body, []);
});

test("DEMO_ADMIN=false: account removed, demo login refused, issued demo tokens rejected", async () => {
  const config = require("../src/lib/config");
  const { User } = require("../src/models");
  const demoLogin = () => request(app).post("/api/auth/login").send({ email: "admin@foodwagon.demo", password: "demo-admin" });
  const token = (await demoLogin()).body.token; // issued while the demo was on
  const asDemo = (req) => req.set("Authorization", `Bearer ${token}`);
  assert.equal((await asDemo(request(app).get("/api/admin/stats"))).status, 200);

  const on = config.demoAdmin;
  config.demoAdmin = null; // what DEMO_ADMIN=false sets
  try {
    // even before the next start removes the account: no login, and the old token is dead everywhere
    assert.equal((await demoLogin()).status, 401);
    for (const path of ["/api/admin/stats", "/api/admin/orders", "/api/admin/messages", "/api/admin/subscribers", "/api/auth/me", "/api/me/orders"]) {
      assert.equal((await asDemo(request(app).get(path))).status, 401, path);
    }
    assert.equal((await asDemo(request(app).post("/api/admin/promos")).send({})).status, 401);

    const out = await seed();
    assert.equal(out.demoAdmin, "off (DEMO_ADMIN=false, removed 1 demo account)");
    assert.equal(await User.countDocuments({ role: "demo" }), 0);
    assert.equal(await User.countDocuments({ email: "admin@foodwagon.demo" }), 0);
    assert.equal((await demoLogin()).status, 401);
    // the real admin is untouched
    assert.equal((await asAdmin(request(app).get("/api/admin/stats"))).status, 200);
    assert.equal((await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" })).body.user.role, "admin");
  } finally {
    config.demoAdmin = on;
  }
  await seed(); // switched back on: the account is created again
  assert.equal((await demoLogin()).body.user.role, "demo");
});
