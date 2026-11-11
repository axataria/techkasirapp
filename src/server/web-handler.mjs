import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';

// Bridge Fetch requests to the shared business handlers. Sessions are explicit
// bearer tokens on the static site; no cross-site cookies or URL tokens.
export function createWebHandler(dispatch, { origin, functionName = 'techkasir-api' }) {
  return async request => {
    const caller = request.headers.get('origin');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
    });
    if (caller && caller !== origin) return new Response('Origin is not allowed', { status: 403, headers });
    if (caller) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PATCH, OPTIONS');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    let path = url.pathname;
    for (const prefix of [`/functions/v1/${functionName}`, `/${functionName}`]) {
      if (path === prefix || path.startsWith(`${prefix}/`)) { path = path.slice(prefix.length) || '/'; break; }
    }
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
    let raw = '';
    if (request.body) {
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) { await reader.cancel(); return new Response('Request is too large', { status: 413, headers }); }
        chunks.push(value);
      }
      raw = Buffer.concat(chunks).toString('utf8');
    }
    const req = Readable.from(raw ? [raw] : []);
    req.method = request.method;
    req.url = path + url.search;
    req.headers = Object.fromEntries(request.headers);
    req.headers.host = new URL(origin).host;
    req.socket = { encrypted: true, remoteAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'edge' };
    let status = 500, body;
    const res = {
      writeHead(next, extra = {}) {
        status = next;
        for (const [key, value] of Object.entries(extra)) if (key.toLowerCase() !== 'set-cookie') headers.set(key, String(value));
      },
      end(value) { body = value; },
    };
    try { await dispatch(req, res); }
    catch (error) { console.error('Edge request failed:', error.code || error.message); status = 503; body = JSON.stringify({ error: 'Server belum tersedia. Coba lagi nanti.' }); headers.set('Content-Type', 'application/json'); }
    return new Response(request.method === 'HEAD' ? null : body, { status, headers });
  };
}
