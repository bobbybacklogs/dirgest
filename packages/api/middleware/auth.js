export function authMiddleware(validKeys) {
  if (!validKeys || validKeys.length === 0) return async (c, next) => next();
  return async (c, next) => {
    const key = c.req.header('x-api-key') || c.req.query('api_key');
    if (!key) return c.json({ ok: false, error: { code: 'unauthorized', message: 'Missing API key. Set X-API-Key header or api_key query parameter.' } }, 401);
    if (!validKeys.includes(key)) return c.json({ ok: false, error: { code: 'forbidden', message: 'Invalid API key.' } }, 403);
    c.set('apiKey', key);
    await next();
  };
}
