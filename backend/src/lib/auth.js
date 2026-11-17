const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { HttpError } = require("./errors");

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
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return undefined; // present but invalid
  }
}

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
  next();
}

function requireAdmin(req, res, next) {
  requireUser(req, res, (err) => {
    if (err) return next(err);
    if (req.auth.role !== "admin") return next(new HttpError(403, "Admins only"));
    next();
  });
}

module.exports = { hashPassword, checkPassword, signToken, optionalAuth, requireUser, requireAdmin };
