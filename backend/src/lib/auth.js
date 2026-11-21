const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { HttpError } = require("./errors");
const { demoEnabled } = require("./demo");

const hashPassword = (pw) => bcrypt.hash(pw, 10);
const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

function signToken(user) {
  if (!config.jwtSecret) throw new HttpError(503, "Login is not configured on this server (JWT_SECRET missing)");
  return jwt.sign({ sub: String(user._id || user.id), role: user.role, name: user.name }, config.jwtSecret, { expiresIn: "7d" });
}

function readToken(req) {
  const [type, token] = (req.headers.authorization || "").split(" ");
  if (type !== "Bearer" || !token || !config.jwtSecret) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Kill switch: with DEMO_ADMIN=false, demo tokens issued earlier (they live 7 days) stop working at once.
    if (payload.role === "demo" && !demoEnabled()) return undefined;
    return payload;
  } catch {
    return undefined; // present but invalid
  }
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEMO_READ_ONLY = "Demo admin is read-only: changes are not saved.";

// Sets req.auth when a valid token is sent; anonymous requests pass through.
function optionalAuth(req, _res, next) {
  const payload = readToken(req);
  if (payload) req.auth = payload;
  next();
}

function requireUser(req, _res, next) {
  const payload = readToken(req);
  if (payload === null) return next(new HttpError(401, "Please log in"));
  if (!payload) return next(new HttpError(401, "Your session has expired, please log in again"));
  req.auth = payload;
  // The shared public demo account never writes anything, on any route (admin, reviews, favourites...).
  if (payload.role === "demo" && !READ_METHODS.has(req.method)) return next(new HttpError(403, DEMO_READ_ONLY));
  next();
}

// Real admins get full rights. The public "demo" role may only read (requireUser refuses its writes),
// and what it reads is filtered by demoAdminView (lib/demo.js), mounted right after this on the admin router.
function requireAdmin(req, res, next) {
  requireUser(req, res, (err) => {
    if (err) return next(err);
    if (req.auth.role === "admin") return next();
    if (req.auth.role === "demo") return next();
    next(new HttpError(403, "Admins only"));
  });
}

module.exports = { DEMO_READ_ONLY, hashPassword, checkPassword, signToken, optionalAuth, requireUser, requireAdmin };
