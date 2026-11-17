const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const config = require("./config");

// Express app with the parts every route shares: security headers, CORS allow-list,
// JSON body, a global rate limit and the health check.
function createBaseApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind a proxy
  // API only serves JSON and images, so the images must be loadable from the static site's origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error("Not allowed by CORS"));
      },
    })
  );
  app.use(express.json({ limit: "50kb" }));
  if (!config.isTest) app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests, try again later" } }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "up" : "down" });
  });
  return app;
}

// Stricter limit for public write endpoints (orders, sign-up, contact...).
const writeLimiter = (limit = 20) =>
  rateLimit({ windowMs: 10 * 60 * 1000, limit: config.isTest ? 1000 : limit, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests, try again later" } });

// toJSON options: expose `id`, hide `_id` and `__v`.
const jsonOpts = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
};

module.exports = { createBaseApp, writeLimiter, jsonOpts };
