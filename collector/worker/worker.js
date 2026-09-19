/**
 * Cloudflare Worker: research session collector. Writes one JSON object per
 * session to Workers KV, partitioned by day. Mirrors collector/server.js.
 *
 * Stores what it is given and nothing else: no IP logging, no cookies, no header
 * reads beyond what CORS needs.
 */

const MAX_BODY = 8 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true });
    }

    if (request.method !== 'POST' || url.pathname !== '/collect') {
      return json({ ok: false, error: 'not found' }, 404);
    }

    const len = parseInt(request.headers.get('content-length') || '0', 10);
    if (len > MAX_BODY) return json({ ok: false, error: 'payload too large' }, 413);

    let record;
    try {
      record = await request.json();
    } catch (_) {
      return json({ ok: false, error: 'invalid json' }, 400);
    }

    if (!record || typeof record !== 'object' || !record.session_id || !Array.isArray(record.events)) {
      return json({ ok: false, error: 'malformed record' }, 400);
    }

    record.received_at = new Date().toISOString();

    const day = record.received_at.slice(0, 10);
    const key = `sessions/${day}/${record.session_id}.json`;
    try {
      await env.SESSIONS.put(key, JSON.stringify(record));
    } catch (err) {
      return json({ ok: false, error: 'storage failed' }, 500);
    }

    return json({ ok: true, key });
  },
};
