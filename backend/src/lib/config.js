require("dotenv").config();

const list = (v, fallback) =>
  (v || fallback)
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "",
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  corsOrigins: list(process.env.CORS_ORIGINS, "https://codelady-ship.github.io,http://localhost:5173,http://localhost:4173"),
  publicUrl: (process.env.PUBLIC_API_URL || "").replace(/\/$/, ""),
  isTest: process.env.NODE_ENV === "test",
};

module.exports = config;
