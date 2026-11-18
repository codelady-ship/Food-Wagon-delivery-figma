const config = require("./lib/config");
const { connect } = require("./lib/db");
const { createApp } = require("./app");
const { seed, ensureAdmin, ensureDemoAdmin } = require("./seed");

if (!config.jwtSecret) console.warn("JWT_SECRET is not set: login, accounts and admin will answer 503.");

connect(config.mongoUri)
  .then(async () => {
    // Render's free plan has no shell, so empty collections are filled on start.
    if (process.env.SEED_ON_START !== "false") console.log("Seed on start:", await seed());
    else console.log("Admin:", await ensureAdmin(), "| demo admin:", await ensureDemoAdmin());
    createApp().listen(config.port, () => console.log(`Food Wagon API listening on port ${config.port}`));
  })
  .catch((err) => {
    console.error("Could not start:", err.message);
    process.exit(1);
  });
