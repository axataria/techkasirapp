import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const lifetime = 10 * 60_000;
const cooldown = 60_000;
const invalidCode = 'Kode salah atau kedaluwarsa. Minta kode baru jika diperlukan.';

export function createRecovery({ db, one, run, tx, bad, bodyOf, json, needUser, passwordHash, verifyPassword, audit, clearLoginFailures }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recovery_emails (
      user_id TEXT PRIMARY KEY REFERENCES users(id), email TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS recovery_codes (
      user_id TEXT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL,
      email TEXT NOT NULL, nonce TEXT NOT NULL, digest TEXT NOT NULL,
      expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, purpose)
    );
    CREATE TABLE IF NOT EXISTS recovery_limits (
      scope TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, requests INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_recovery_codes (
      user_id TEXT PRIMARY KEY REFERENCES users(id), digest TEXT NOT NULL UNIQUE
    );
  `);
  const { RESEND_API_KEY: apiKey, TECHKASIR_RECOVERY_FROM: from, TECHKASIR_RECOVERY_SECRET: secret } = process.env;
  const enabled = Boolean(apiKey && from && secret?.length >= 32);

  function emailAddress(value) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw bad('Masukkan alamat email yang valid.');
    return email;
  }

  function limit(scope, maximum) {
    const now = Date.now();
    run('DELETE FROM recovery_limits WHERE expires_at <= ?', now);
    const entry = one('SELECT requests FROM recovery_limits WHERE scope=?', scope);
    if (entry?.requests >= maximum) throw bad('Terlalu banyak percobaan. Coba lagi dalam 15 menit.', 429);
    run(`INSERT INTO recovery_limits VALUES (?,?,1)
      ON CONFLICT(scope) DO UPDATE SET requests=requests+1`, scope, now + 15 * 60_000);
  }

  const savedDigest = code => createHash('sha256').update(code).digest('hex');

  // Call inside the transaction that creates the owner or changes their password.
  function issueSavedCode(userId) {
    const code = randomBytes(16).toString('hex').toUpperCase();
    run(`INSERT INTO saved_recovery_codes VALUES (?,?)
      ON CONFLICT(user_id) DO UPDATE SET digest=excluded.digest`, userId, savedDigest(code));
    return code.match(/.{4}/g).join('-');
  }

  function changePassword(user, password) {
    run('UPDATE users SET password_hash=? WHERE id=?', passwordHash(password), user.id);
    run('DELETE FROM sessions WHERE user_id=?', user.id);
    run('DELETE FROM recovery_codes WHERE user_id=?', user.id);
    audit(user, 'user', user.id, 'password_recovered');
    return user.role === 'owner' ? issueSavedCode(user.id) : undefined;
  }

  function newPassword(value) {
    const password = typeof value === 'string' ? value : '';
    if (password.trim().length < 10 || password.length > 256) throw bad('Kata sandi harus berisi 10 sampai 256 karakter.');
    return password;
  }

  function digest(user, purpose, email, nonce, code) {
    return createHmac('sha256', secret).update(JSON.stringify([user.id, user.password_hash, purpose, email, nonce, code])).digest('hex');
  }

  function issue(user, purpose, email) {
    const now = Date.now();
    const previous = one('SELECT expires_at FROM recovery_codes WHERE user_id=? AND purpose=?', user.id, purpose);
    if (previous && previous.expires_at - lifetime + cooldown > now) return null;
    const code = String(randomInt(100_000_000)).padStart(8, '0');
    const nonce = randomUUID();
    run(`INSERT INTO recovery_codes VALUES (?,?,?,?,?,?,0)
      ON CONFLICT(user_id,purpose) DO UPDATE SET email=excluded.email, nonce=excluded.nonce,
      digest=excluded.digest, expires_at=excluded.expires_at, attempts=0`,
      user.id, purpose, email, nonce, digest(user, purpose, email, nonce, code), now + lifetime);
    return code;
  }

  async function deliver(email, code, purpose) {
    const action = purpose === 'verify' ? 'verifikasi email pemulihan' : 'reset kata sandi';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: `Kode ${action} TechKasir`,
        text: `Kode ${action} TechKasir Anda: ${code}\n\nKode berlaku 10 menit dan hanya dapat dipakai sekali. Abaikan email ini jika Anda tidak meminta kode.` }),
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (!response.ok) throw Error('Recovery email delivery failed');
  }

  function accept(user, purpose, email, code, apply) {
    if (typeof code !== 'string' || !/^\d{8}$/.test(code)) throw bad(invalidCode);
    const accepted = tx(() => {
      const record = user && one('SELECT * FROM recovery_codes WHERE user_id=? AND purpose=?', user.id, purpose);
      if (!record || record.email !== email || record.expires_at <= Date.now() || record.attempts >= 5) return false;
      const candidate = digest(user, purpose, email, record.nonce, code);
      if (!timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(record.digest, 'hex'))) {
        run('UPDATE recovery_codes SET attempts=attempts+1 WHERE user_id=? AND purpose=?', user.id, purpose);
        return false;
      }
      apply();
      run('DELETE FROM recovery_codes WHERE user_id=?', user.id);
      return true;
    });
    if (!accepted) throw bad(invalidCode);
  }

  const verifiedUser = email => one(`SELECT u.* FROM users u JOIN recovery_emails e ON e.user_id=u.id
    WHERE e.email=? AND u.active=1`, email);

  async function handle(req, res, path) {
    const prefix = '/api/recovery/';
    if (!path.startsWith(prefix)) return false;
    const action = path.slice(prefix.length);
    if (req.method === 'GET' && action === 'email') {
      const user = needUser(req);
      json(res, 200, { enabled, email: one('SELECT email FROM recovery_emails WHERE user_id=?', user.id)?.email ?? null,
        hasSavedCode: Boolean(one('SELECT user_id FROM saved_recovery_codes WHERE user_id=?', user.id)) });
      return true;
    }
    if (req.method === 'POST' && action === 'saved/replace') {
      needUser(req);
      const { currentPassword } = await bodyOf(req);
      const session = needUser(req);
      if (session.role !== 'owner') throw bad('Akses tidak diizinkan.', 403);
      const user = one('SELECT * FROM users WHERE id=? AND active=1', session.id);
      limit(`saved-replace:${user.id}`, 5);
      if (typeof currentPassword !== 'string' || currentPassword.length > 256 || !verifyPassword(currentPassword, user.password_hash)) throw bad('Kata sandi saat ini salah.', 403);
      const recoveryCode = tx(() => {
        const code = issueSavedCode(user.id);
        audit(user, 'user', user.id, 'saved_recovery_code_issued');
        return code;
      });
      json(res, 200, { username: user.username, recoveryCode });
      return true;
    }
    if (req.method === 'POST' && action === 'saved/reset') {
      const body = await bodyOf(req);
      limit(`saved-reset:${req.socket.remoteAddress}`, 20);
      const code = typeof body.recoveryCode === 'string' && body.recoveryCode.length <= 64
        ? body.recoveryCode.replace(/[\s-]/g, '').toUpperCase() : '';
      if (!/^[0-9A-F]{32}$/.test(code)) throw bad('Kode pemulihan salah atau sudah tidak berlaku.');
      const password = newPassword(body.password);
      const result = tx(() => {
        const user = one(`SELECT u.* FROM users u JOIN saved_recovery_codes c ON c.user_id=u.id
          WHERE c.digest=? AND u.active=1 AND u.role='owner'`, savedDigest(code));
        if (!user) throw bad('Kode pemulihan salah atau sudah tidak berlaku.');
        return { username: user.username, recoveryCode: changePassword(user, password) };
      });
      clearLoginFailures(req, result.username);
      json(res, 200, result);
      return true;
    }
    if (req.method !== 'POST' || !['email/request', 'email/verify', 'reset/request', 'reset/complete'].includes(action)) return false;
    if (!enabled) throw bad('Email pemulihan belum dikonfigurasi oleh pengelola aplikasi.', 503);

    const enrollment = action.startsWith('email/');
    if (enrollment) needUser(req);
    const body = await bodyOf(req);
    const email = emailAddress(body.email);
    limit(`${action}:${req.socket.remoteAddress}`, 30);
    if (enrollment) {
      const session = needUser(req);
      const user = one('SELECT * FROM users WHERE id=? AND active=1', session.id);
      if (action === 'email/request') {
        limit(`enrollment:${user.id}`, 5);
        if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 256 || !verifyPassword(body.currentPassword, user.password_hash)) throw bad('Kata sandi saat ini salah.', 403);
        if (one('SELECT user_id FROM recovery_emails WHERE email=? AND user_id<>?', email, user.id)) throw bad('Alamat ini tidak dapat dipakai sebagai email pemulihan.', 409);
        const code = issue(user, 'verify', email);
        if (!code) throw bad('Tunggu satu menit sebelum meminta kode lagi.', 429);
        try { await deliver(email, code, 'verify'); } catch { throw bad('Email belum berhasil dikirim. Coba lagi nanti.', 503); }
      } else {
        accept(user, 'verify', email, body.code, () => {
          if (one('SELECT user_id FROM recovery_emails WHERE email=? AND user_id<>?', email, user.id)) throw bad('Alamat ini tidak dapat dipakai sebagai email pemulihan.', 409);
          run(`INSERT INTO recovery_emails VALUES (?,?)
            ON CONFLICT(user_id) DO UPDATE SET email=excluded.email`, user.id, email);
          audit(user, 'user', user.id, 'recovery_email_verified');
        });
      }
    } else if (action === 'reset/request') {
      const user = verifiedUser(email);
      const code = user && issue(user, 'reset', email);
      // Provider latency and delivery errors must not reveal whether an account exists.
      if (code) void deliver(email, code, 'reset').catch(() => console.warn('TechKasir could not send a password recovery email.'));
    } else {
      const password = newPassword(body.password);
      const user = verifiedUser(email);
      let recoveryCode;
      accept(user, 'reset', email, body.code, () => {
        recoveryCode = changePassword(user, password);
      });
      clearLoginFailures(req, user.username);
      json(res, 200, { ok: true, username: user.username, recoveryCode });
      return true;
    }
    json(res, 200, { ok: true });
    return true;
  }
  return { handle, issueSavedCode };
}
