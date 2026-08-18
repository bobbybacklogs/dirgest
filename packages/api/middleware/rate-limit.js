export function rateLimitMiddleware({ windowMs = 60_000, maxRequests = 60 } = {}) {
  const hits = new Map();
  const cleanup = () => {
    const now = Date.now();
    for (const [key, record] of hits) {
      if (now - record.windowStart > windowMs) hits.delete(key);
    }
  };
  const interval = setInterval(cleanup, windowMs);
  if (interval.unref) interval.unref();

  return async (c, next) => {
    const key = c.get('apiKey') || c.req.header('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    let record = hits.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { windowStart: now, count: 0 };
      hits.set(key, record);
    }
    record.count += 1;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil((record.windowStart + windowMs) / 1000)));
    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ ok: false, error: { code: 'rate-limited', message: `Rate limit exceeded. Try again in ${retryAfter}s.` } }, 429);
    }
    await next();
  };
}
