import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';

process.env.TECHKASIR_DATA_DIR = mkdtempSync(join(tmpdir(), 'techkasir-recovery-test-'));
process.env.RESEND_API_KEY = 'recovery-test-key';
process.env.TECHKASIR_RECOVERY_FROM = 'test@example.com';
process.env.TECHKASIR_RECOVERY_SECRET = 'test-only-recovery-secret-32-characters';

const deliveries = [];
const httpFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  deliveries.push(JSON.parse(options.body));
  return new Response(null, { status: 200 });
};

const { handleStoreRequest } = await import('./src/server/store.mjs');
const server = createServer(handleStoreRequest).listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const db = new DatabaseSync(join(process.env.TECHKASIR_DATA_DIR, 'store.db'));

async function request(path, body, status = 200, cookie = '', method = body ? 'POST' : 'GET') {
  const response = await httpFetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, status, `${path} ${JSON.stringify(result)}`);
  return { result, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function lastCode() {
  const code = deliveries.at(-1).text.match(/\b\d{8}\b/)?.[0];
  assert.ok(code);
  return code;
}

try {
  const oldPassword = 'original-password-123';
  const password = 'new-password-123';
  const username = 'owner';
  const email = 'owner@example.com';
  await request('/setup', { storeName: 'Recovery test', name: 'Owner', username: 'original-owner', password: oldPassword }, 201);
  const { cookie } = await request('/login', { username: 'original-owner', password: oldPassword });
  await request('/users', { name: 'Cashier', username: 'cashier', role: 'cashier', password }, 201, cookie);
  const identity = { name: 'Updated owner', username, currentPassword: oldPassword };
  await request('/me', identity, 401, '', 'PATCH');
  await request('/me', { ...identity, currentPassword: password }, 403, cookie, 'PATCH');
  await request('/me', { ...identity, username: 'Cashier' }, 409, cookie, 'PATCH');
  const profile = await request('/me', { ...identity, username: 'OWNER', role: 'cashier' }, 200, cookie, 'PATCH');
  assert.equal(profile.result.username, username);
  assert.equal(profile.result.role, 'owner');
  assert.equal((await request('/me', null, 200, cookie)).result.name, identity.name);
  await request('/login', { username: 'original-owner', password: oldPassword }, 401);
  await request('/recovery/email/request', { email, currentPassword: oldPassword }, 401);
  await request('/recovery/email/request', { email, currentPassword: password }, 403, cookie);
  const unknown = await request('/recovery/reset/request', { email: 'unknown@example.com' });
  await request('/recovery/reset/request', { email });
  assert.equal(deliveries.length, 0, 'Unverified email cannot receive a reset code');
  await request('/recovery/email/request', { email: 'Owner@EXAMPLE.COM', currentPassword: oldPassword }, 200, cookie);
  const verificationCode = lastCode();
  assert.deepEqual(deliveries.at(-1).to, [email]);
  assert.equal((await request('/recovery/email', null, 200, cookie)).result.email, null);
  await request('/recovery/email/verify', { email, code: verificationCode }, 200, cookie);
  await request('/recovery/email/verify', { email, code: verificationCode }, 400, cookie);
  assert.deepEqual((await request('/recovery/email', null, 200, cookie)).result, { enabled: true, email, hasSavedCode: true });

  const known = await request('/recovery/reset/request', { email });
  assert.deepEqual(known.result, unknown.result);
  const firstCode = lastCode();
  await request('/recovery/reset/request', { email });
  assert.equal(deliveries.length, 2, 'Immediate resend does not send another email');
  const wrong = firstCode === '00000000' ? '00000001' : '00000000';
  for (let attempt = 0; attempt < 5; attempt++) await request('/recovery/reset/complete', { email, code: wrong, password }, 400);
  await request('/recovery/reset/complete', { email, code: firstCode, password }, 400);

  db.prepare('UPDATE recovery_codes SET expires_at=0 WHERE purpose=?').run('reset');
  await request('/recovery/reset/request', { email });
  const expiredCode = lastCode();
  db.prepare('UPDATE recovery_codes SET expires_at=0 WHERE purpose=?').run('reset');
  await request('/recovery/reset/complete', { email, code: expiredCode, password }, 400);
  await request('/recovery/reset/request', { email });
  const validCode = lastCode();
  for (let attempt = 0; attempt < 5; attempt++) await request('/login', { username, password }, 401);
  await request('/login', { username, password: oldPassword }, 429);
  assert.equal((await request('/recovery/reset/complete', { email, code: validCode, password })).result.username, username);
  await request('/recovery/reset/complete', { email, code: validCode, password }, 400);
  await request('/me', null, 401, cookie);
  await request('/login', { username, password: oldPassword }, 401);
  await request('/login', { username, password });
  console.log('Recovery integration passed: verified enrollment, private reset response, resend cooldown, guess limit, expiry, replay rejection, session revocation and new login.');
} finally {
  db.close();
  server.close();
  globalThis.fetch = httpFetch;
}
