// Fills the database from backend/data/menu.json (the same file the static site falls back to).
// Usage: npm run seed            -> inserts only into empty collections
//        npm run seed -- --reset -> wipes restaurants and dishes first (orders are kept)
const mongoose = require("mongoose");
const config = require("./lib/config");
const { connect } = require("./lib/db");
const { Restaurant, Dish } = require("./models");
const data = require("../data/menu.json");

async function seed({ reset = false } = {}) {
  if (reset) await Promise.all([Restaurant.deleteMany({}), Dish.deleteMany({})]);
  const out = {};
  const fill = async (Model, rows, key) => {
    if (await Model.estimatedDocumentCount()) return (out[key] = "skipped (not empty)");
    await Model.insertMany(rows.map((r, i) => ({ ...r, order: i })));
    out[key] = rows.length;
  };
  await fill(Restaurant, data.restaurants, "restaurants");
  await fill(Dish, data.dishes, "dishes");
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

module.exports = { seed };
