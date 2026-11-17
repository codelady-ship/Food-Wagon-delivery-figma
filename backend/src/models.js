const mongoose = require("mongoose");
const { jsonOpts } = require("./lib/base");
const { CATEGORIES, ORDER_STATUSES } = require("../shared/catalog.mjs");

const slugType = { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ };
const hhmm = { type: String, match: /^\d{2}:\d{2}$/ };
const opts = { timestamps: true, toJSON: jsonOpts };

const restaurantSchema = new mongoose.Schema(
  {
    slug: slugType,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    cuisines: [{ type: String, enum: CATEGORIES }],
    priceLevel: { type: Number, min: 1, max: 3, default: 2 },
    chef: { type: String, trim: true, maxlength: 60, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    deliveryTime: { type: Number, min: 5, max: 120, default: 30 }, // minutes
    deliveryFee: { type: Number, min: 0, max: 20, default: 2.5 },
    address: { type: String, trim: true, maxlength: 160, default: "" },
    image: { type: String, required: true },
    alt: { type: String, default: "" },
    discount: { type: Number, min: 0, max: 90, default: 0 },
    fast: { type: Boolean, default: false },
    opensAt: { ...hhmm, default: "10:00" },
    closesAt: { ...hhmm, default: "22:00" },
    order: { type: Number, default: 0 },
    baseRating: { type: Number }, // seeded/admin rating before site reviews
    baseCount: { type: Number },
  },
  {
    timestamps: true,
    toJSON: {
      ...jsonOpts,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.baseRating;
        delete ret.baseCount;
        return ret;
      },
    },
  }
);

const dishSchema = new mongoose.Schema(
  {
    slug: slugType,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: "" },
    restaurant: { type: String, required: true, index: true }, // restaurant slug
    restaurantName: { type: String, required: true },
    price: { type: Number, required: true, min: 0.5, max: 500 },
    cat: { type: String, enum: CATEGORIES, required: true, index: true },
    image: { type: String, required: true }, // site-relative path (images/x.webp) or API upload URL
    alt: { type: String, default: "" },
    popular: { type: Boolean, default: false },
    featured: { type: Boolean, default: false }, // shown in the "Most loved" orbit menu
    cutout: { type: String, default: "" }, // transparent top-down plate image for the orbit menu
    headline: [{ type: String, maxlength: 30 }], // two-part title for the orbit menu
    ingredients: [{ type: String, maxlength: 40 }],
    accent: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: "#F17228" },
    chef: { type: String, maxlength: 60, default: "" },
    likes: { type: Number, min: 0, default: 0 },
    available: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  opts
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    items: [
      {
        _id: false,
        dish: { type: String, required: true },
        name: { type: String, required: true },
        restaurant: { type: String, required: true },
        restaurantName: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1, max: 20 },
      },
    ],
    mode: { type: String, enum: ["delivery", "pickup"], required: true },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 60 },
      phone: { type: String, required: true, trim: true, maxlength: 25 },
      email: { type: String, trim: true, maxlength: 120, default: "" },
      address: { type: String, trim: true, maxlength: 160, default: "" },
    },
    note: { type: String, trim: true, maxlength: 300, default: "" },
    promoCode: { type: String, default: "" },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    payment: { type: String, enum: ["card_demo", "cash"], default: "card_demo" },
    status: { type: String, enum: ORDER_STATUSES, default: "received", index: true },
    manualStatus: { type: Boolean, default: false }, // true once an admin sets the status
  },
  opts
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    favourites: [{ type: String }], // restaurant slugs
  },
  {
    timestamps: true,
    toJSON: {
      ...jsonOpts,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

const reviewSchema = new mongoose.Schema(
  {
    restaurant: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: "" },
  },
  opts
);
reviewSchema.index({ restaurant: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });

const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,20}$/ },
    type: { type: String, enum: ["percent", "fixed", "free_delivery"], required: true },
    value: { type: Number, min: 0, max: 100, default: 0 },
    minSubtotal: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, maxlength: 120, default: "" },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
    maxUses: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    uses: { type: Number, min: 0, default: 0 },
  },
  opts
);

const subscriberSchema = new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true } }, opts);

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, maxlength: 120 },
    topic: { type: String, enum: ["order", "partner", "feedback", "other"], default: "other" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    handled: { type: Boolean, default: false },
  },
  opts
);

// Uploaded images live in MongoDB (Render's free disk is wiped on every deploy).
const uploadSchema = new mongoose.Schema(
  {
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = {
  Restaurant: mongoose.model("Restaurant", restaurantSchema),
  Dish: mongoose.model("Dish", dishSchema),
  Order: mongoose.model("Order", orderSchema),
  User: mongoose.model("User", userSchema),
  Review: mongoose.model("Review", reviewSchema),
  Promo: mongoose.model("Promo", promoSchema),
  Subscriber: mongoose.model("Subscriber", subscriberSchema),
  Message: mongoose.model("Message", messageSchema),
  Upload: mongoose.model("Upload", uploadSchema),
};
