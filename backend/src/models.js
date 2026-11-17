const mongoose = require("mongoose");
const { jsonOpts } = require("./lib/base");

const CATEGORIES = ["italian", "burger", "asian", "chicken", "healthy", "dessert", "drinks"];
const ORDER_STATUSES = ["received", "preparing", "on_the_way", "ready_for_pickup", "delivered", "cancelled"];
const slugType = { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ };
const opts = { timestamps: true, toJSON: jsonOpts };

const restaurantSchema = new mongoose.Schema(
  {
    slug: slugType,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    image: { type: String, required: true },
    alt: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    discount: { type: Number, min: 0, max: 90, default: 0 },
    fast: { type: Boolean, default: false },
    opensAt: { type: String, match: /^\d{2}:\d{2}$/, default: "10:00" },
    closesAt: { type: String, match: /^\d{2}:\d{2}$/, default: "22:00" },
    order: { type: Number, default: 0 },
  },
  opts
);

const dishSchema = new mongoose.Schema(
  {
    slug: slugType,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    restaurant: { type: String, required: true, index: true }, // restaurant slug
    restaurantName: { type: String, required: true },
    price: { type: Number, required: true, min: 0.5, max: 500 },
    cat: { type: String, enum: CATEGORIES, required: true, index: true },
    img: { type: String, required: true, match: /^[a-z0-9-]+$/ }, // file name in images/, without .webp
    alt: { type: String, default: "" },
    available: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  opts
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    items: [
      {
        _id: false,
        dish: { type: String, required: true }, // dish slug
        name: { type: String, required: true },
        restaurantName: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1, max: 20 },
      },
    ],
    mode: { type: String, enum: ["delivery", "pickup"], required: true },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 60 },
      phone: { type: String, required: true, trim: true, maxlength: 25 },
      address: { type: String, trim: true, maxlength: 160, default: "" },
    },
    note: { type: String, trim: true, maxlength: 300, default: "" },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "received", index: true },
  },
  opts
);

module.exports = {
  CATEGORIES,
  ORDER_STATUSES,
  Restaurant: mongoose.model("Restaurant", restaurantSchema),
  Dish: mongoose.model("Dish", dishSchema),
  Order: mongoose.model("Order", orderSchema),
};
