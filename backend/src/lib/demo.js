// Everything the public read-only "demo" role may see lives here.
//  - demoEnabled(): the DEMO_ADMIN kill switch. When it is off, demo logins and demo tokens are refused.
//  - demoAdminView: mounted once on the admin router. For the demo role it is deny-by-default: a GET path
//    answers only if it is listed in VIEWS, and its JSON goes through that view before it is sent. A new
//    admin endpoint is therefore invisible to the demo role until someone decides here what it may show.
//    Personal fields are replaced by fixed placeholders (nothing is derived from the real value), and only
//    the query parameters listed for a view reach the handler, so filters cannot be used to probe real values.
const config = require("./config");
const { HttpError } = require("./errors");

const HIDDEN = "Hidden in the public demo";
const HIDDEN_PHONE = "+000 00 000 00 00";
const hiddenEmail = (n) => `hidden-${n}@demo.invalid`;

const demoEnabled = () => Boolean(config.demoAdmin);
const isDemo = (req) => req.auth?.role === "demo";

const asIs = (body) => body;
const pick = (row, keys) => Object.fromEntries(keys.filter((k) => row[k] !== undefined).map((k) => [k, row[k]]));

const ORDER_FIELDS = ["id", "reference", "status", "mode", "promoCode", "payment", "subtotal", "discount", "deliveryFee", "total", "manualStatus", "createdAt", "updatedAt"];
const ITEM_FIELDS = ["dish", "name", "restaurant", "restaurantName", "price", "qty"];

const VIEWS = {
  "/stats": { view: asIs }, // counts and a revenue sum only
  "/dishes": { view: asIs }, // public catalogue
  "/promos": { view: asIs }, // codes are shown on the site
  "/orders": {
    query: ["status"],
    view: (rows) =>
      rows.map((o, i) => ({
        ...pick(o, ORDER_FIELDS),
        items: (o.items || []).map((it) => pick(it, ITEM_FIELDS)),
        customer: { name: `Customer ${i + 1}`, phone: HIDDEN_PHONE, email: o.customer?.email ? hiddenEmail(i + 1) : "", address: o.customer?.address ? HIDDEN : "" },
        note: o.note ? HIDDEN : "",
      })),
  },
  "/messages": {
    view: (rows) => rows.map((m, i) => ({ ...pick(m, ["id", "topic", "handled", "createdAt", "updatedAt"]), name: `Visitor ${i + 1}`, email: hiddenEmail(i + 1), message: HIDDEN })),
  },
  "/subscribers": {
    view: (rows) => rows.map((s, i) => ({ ...pick(s, ["id", "createdAt", "updatedAt"]), email: hiddenEmail(i + 1) })),
  },
};

function demoAdminView(req, res, next) {
  if (!isDemo(req)) return next();
  const entry = VIEWS[req.path.replace(/\/+$/, "") || "/"];
  if (!entry) return next(new HttpError(403, "This page is not part of the public demo"));
  const allowed = entry.query || [];
  const query = Object.fromEntries(Object.entries(req.query).filter(([k, v]) => allowed.includes(k) && typeof v === "string"));
  Object.defineProperty(req, "query", { value: query, configurable: true });
  const send = res.json.bind(res);
  res.json = (body) => (res.statusCode < 400 ? send(entry.view(JSON.parse(JSON.stringify(body)))) : send(body));
  next();
}

module.exports = { HIDDEN, demoEnabled, isDemo, demoAdminView, DEMO_VIEWS: VIEWS };
