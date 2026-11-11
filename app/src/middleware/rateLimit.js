// Fixed-window limiter keyed by client IP. Used on the login endpoint to slow down credential stuffing.
function rateLimit({ limit, windowMs = 60_000, now = () => Date.now() }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const current = now();
    const entry = hits.get(key);
    if (!entry || current - entry.start >= windowMs) {
      hits.set(key, { start: current, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - current) / 1000));
      return res.status(429).json({ error: 'Too many requests, try again later' });
    }
    return next();
  };
}

module.exports = { rateLimit };
