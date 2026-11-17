// Local API without installing MongoDB: starts an in-memory MongoDB, seeds it and serves the API.
// Data is lost when the process stops. Usage: npm run dev:memory
process.env.JWT_SECRET ||= "dev-only-secret";
process.env.ADMIN_EMAIL ||= "admin@foodwagon.local";
process.env.ADMIN_PASSWORD ||= "admin12345";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server-core");

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("food-wagon-dev"));
  mongoose.connection.on("disconnected", () => console.warn("In-memory MongoDB disconnected"));
  const config = require("../src/lib/config");
  const { seed } = require("../src/seed");
  const { createApp } = require("../src/app");
  console.log("Seed:", await seed());
  createApp().listen(config.port, () => console.log(`Food Wagon API (in-memory DB) on http://localhost:${config.port} - admin ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`));
  const stop = async () => {
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
