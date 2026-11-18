// Fills the database from backend/data/seed.json (the same file the static site uses as its offline demo data)
// and creates/updates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD, plus the public read-only demo admin
// (admin@foodwagon.demo / demo-admin, role "demo": opens every admin page, every write answers 403).
// Usage: npm run seed            -> inserts only into empty collections
//        npm run seed -- --reset -> wipes catalogue, promos and seed reviews first (orders and users are kept)
const mongoose = require("mongoose");
const config = require("./lib/config");
const { connect } = require("./lib/db");
const { hashPassword } = require("./lib/auth");
const { Restaurant, Dish, Promo, Review, User } = require("./models");
const data = require("../data/seed.json");

async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return "skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)";
  const passwordHash = await hashPassword(config.adminPassword);
  await User.findOneAndUpdate(
    { email: config.adminEmail },
    { $set: { role: "admin", passwordHash }, $setOnInsert: { name: "Admin", email: config.adminEmail } },
    { upsert: true }
  );
  return config.adminEmail;
}

async function ensureDemoAdmin() {
  const demo = config.demoAdmin;
  if (!demo) return "skipped (DEMO_ADMIN=false)";
  if (demo.email === config.adminEmail) return "skipped (same email as ADMIN_EMAIL)";
  await User.findOneAndUpdate(
    { email: demo.email },
    { $set: { role: "demo", name: "Demo Admin", passwordHash: await hashPassword(demo.password) }, $setOnInsert: { email: demo.email } },
    { upsert: true }
  );
  return demo.email;
}

async function seed({ reset = false } = {}) {
  if (reset) await Promise.all([Restaurant.deleteMany({}), Dish.deleteMany({}), Promo.deleteMany({}), Review.deleteMany({ user: { $exists: false } })]);
  const out = {};
  const names = Object.fromEntries(data.restaurants.map((r) => [r.slug, r.name]));
  const fill = async (Model, rows, key) => {
    if (await Model.estimatedDocumentCount()) return (out[key] = "skipped (not empty)");
    await Model.insertMany(rows);
    out[key] = rows.length;
  };
  await fill(Restaurant, data.restaurants.map((r, i) => ({ ...r, order: i, baseRating: r.rating, baseCount: r.ratingCount })), "restaurants");
  await fill(Dish, data.dishes.map((d, i) => ({ ...d, restaurantName: names[d.restaurant], order: i })), "dishes");
  await fill(Promo, data.promos, "promos");
  await fill(Review, data.reviews, "reviews");
  out.admin = await ensureAdmin();
  out.demoAdmin = await ensureDemoAdmin();
  return out;
}

if (require.main === module) {
  connect(config.mongoUri)
    .then(() => seed({ reset: process.argv.includes("--reset") }))
    .then((out) => console.log("Seed done:", out))
    .catch((err) => {
      console.error("Seed failed:", err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { seed, ensureAdmin, ensureDemoAdmin };
