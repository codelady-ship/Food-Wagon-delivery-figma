// API tests on an in-memory MongoDB. Run: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const { createApp, isOpenNow } = require("../src/app");
const { seed } = require("../src/seed");

let mongo;
let app;
let auth;
let reference;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("fw-test"));
  await seed();
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test("menu: restaurants and dishes with filters", async () => {
  const rest = await request(app).get("/api/restaurants");
  assert.equal(rest.body.length, 4);
  assert.equal(typeof rest.body[0].openNow, "boolean");
  assert.equal((await request(app).get("/api/dishes")).body.length, 12);
  const asian = await request(app).get("/api/dishes?cat=asian");
  assert.ok(asian.body.length === 2 && asian.body.every((d) => d.cat === "asian"));
  const q = await request(app).get("/api/dishes?q=golden%20fork");
  assert.ok(q.body.length >= 1 && q.body.every((d) => d.restaurantName === "Golden Fork Bistro"));
  assert.equal((await request(app).get("/api/dishes?q=(((")).status, 200); // regex input is escaped
  assert.equal((await request(app).get("/api/dishes/veggie-pizza")).body.price, 12.5);
  assert.equal((await request(app).get("/api/dishes/nope")).status, 404);
});

test("opening hours helper", () => {
  const r = { opensAt: "10:00", closesAt: "00:00" };
  assert.equal(isOpenNow(r, new Date("2026-01-01T08:00:00Z")), true); // 12:00 Baku
  assert.equal(isOpenNow(r, new Date("2026-01-01T02:00:00Z")), false); // 06:00 Baku
});

test("orders: server prices the order, client prices ignored", async () => {
  const res = await request(app)
    .post("/api/orders")
    .send({ items: [{ dish: "veggie-pizza", qty: 1, price: 0.01 }, { dish: "fresh-orange-juice", qty: 2 }, { dish: "veggie-pizza", qty: 1 }], mode: "delivery", name: "Test Customer", phone: "+994 50 000 00 00", address: "Nizami street 10, Baku" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.reference, /^FW-[0-9A-F]{6}$/);
  assert.equal(res.body.subtotal, 32.8); // 2 x 12.5 + 2 x 3.9
  assert.equal(res.body.deliveryFee, 0); // free from 30
  assert.equal(res.body.total, 32.8);
  assert.equal(res.body.customer, undefined);
  reference = res.body.reference;

  const small = await request(app).post("/api/orders").send({ items: [{ dish: "chocolate-brownie", qty: 1 }], mode: "delivery", name: "Test Customer", phone: "+994500000000", address: "Nizami street 10" });
  assert.equal(small.body.deliveryFee, 2.5);
  assert.equal(small.body.total, 8);
  const pickup = await request(app).post("/api/orders").send({ items: [{ dish: "chocolate-brownie", qty: 1 }], mode: "pickup", name: "Test Customer", phone: "+994500000000" });
  assert.equal(pickup.body.total, 5.5);
});

test("orders: validation", async () => {
  const empty = await request(app).post("/api/orders").send({ items: [], mode: "delivery", name: "A", phone: "1" });
  assert.equal(empty.status, 400);
  const fields = empty.body.details.map((d) => d.field);
  assert.ok(fields.includes("items") && fields.includes("name") && fields.includes("phone"));
  const noAddress = await request(app).post("/api/orders").send({ items: [{ dish: "veggie-pizza", qty: 1 }], mode: "delivery", name: "Test", phone: "+994500000000" });
  assert.equal(noAddress.body.details[0].field, "address");
  const unknown = await request(app).post("/api/orders").send({ items: [{ dish: "caviar", qty: 1 }], mode: "pickup", name: "Test", phone: "+994500000000" });
  assert.equal(unknown.status, 400);
});

test("orders: public tracking hides personal data", async () => {
  const t = await request(app).get(`/api/orders/${reference.toLowerCase()}`);
  assert.equal(t.status, 200);
  assert.equal(t.body.status, "received");
  assert.equal(JSON.stringify(t.body).includes("Nizami"), false);
  assert.equal((await request(app).get("/api/orders/FW-000000")).status, 404);
});

test("admin: auth, orders and menu CRUD", async () => {
  assert.equal((await request(app).get("/api/admin/orders")).status, 401);
  assert.equal((await request(app).get("/api/admin/orders").set("Authorization", "Bearer bad")).status, 401);
  const login = await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" });
  auth = { Authorization: `Bearer ${login.body.token}` };

  const orders = await request(app).get("/api/admin/orders").set(auth);
  assert.equal(orders.body.length, 3);
  assert.equal(orders.body.find((o) => o.reference === reference).customer.address, "Nizami street 10, Baku");
  const upd = await request(app).patch(`/api/admin/orders/${reference}`).set(auth).send({ status: "preparing" });
  assert.equal(upd.body.status, "preparing");
  assert.equal((await request(app).patch(`/api/admin/orders/${reference}`).set(auth).send({ status: "lost" })).status, 400);

  const dish = { slug: "falafel-wrap", name: "Falafel Wrap", restaurant: "urban-loft-kitchen", price: 8, cat: "healthy", img: "salad" };
  const created = await request(app).post("/api/admin/dishes").set(auth).send(dish);
  assert.equal(created.status, 201);
  assert.equal(created.body.restaurantName, "Urban Loft Kitchen");
  assert.equal((await request(app).post("/api/admin/dishes").set(auth).send(dish)).status, 409);
  assert.equal((await request(app).post("/api/admin/dishes").set(auth).send({ ...dish, slug: "x-1", restaurant: "nowhere" })).status, 400);
  assert.equal((await request(app).put("/api/admin/dishes/falafel-wrap").set(auth).send({ price: 9 })).body.price, 9);
  assert.equal((await request(app).delete("/api/admin/dishes/falafel-wrap").set(auth)).status, 204);
  assert.equal((await request(app).delete("/api/admin/restaurants/urban-loft-kitchen").set(auth)).status, 409);
});
