import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createDatabase, postgresSql } from './src/server/database.mjs';

// Never run destructive fixture cleanup in the production schema.
if (!process.env.DATABASE_URL || !/^techkasir_verify_[a-z0-9_]+$/.test(process.env.TECHKASIR_DATABASE_SCHEMA || '')) {
  throw Error('PostgreSQL tests require DATABASE_URL and an isolated TECHKASIR_DATABASE_SCHEMA=techkasir_verify_...');
}
assert.equal(postgresSql("SELECT '?' label, ? value, 'it''s ?' escaped"), "SELECT '?' label, $1 value, 'it''s ?' escaped");
const db = await createDatabase();
const tables = [...readFileSync(new URL('./scripts/database/schema.sql', import.meta.url), 'utf8').matchAll(/CREATE TABLE (\w+)\s*\(/g)]
  .map(([, name]) => name).filter(name => name !== 'schema_version');
async function clean() {
  await db.tx(async () => { for (const table of [...tables].reverse()) await db.run(`DELETE FROM ${table}`); });
}
try {
  await clean();
  await db.request(async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, () => db.one('SELECT 9007199254740993::bigint AS amount')));
    assert(rows.every(row => row.amount === '9007199254740993'));
  });
  await assert.rejects(db.tx(async () => {
    await db.run('INSERT INTO stores VALUES(?,?,?)', 'rollback-check', 'Rollback', new Date().toISOString());
    throw Error('rollback probe');
  }), /rollback probe/);
  assert.equal(await db.one('SELECT id FROM stores WHERE id=?', 'rollback-check'), undefined);
  for (const check of ['test.mjs', 'v2.test.mjs']) {
    await clean();
    const child = spawn(process.execPath, [check], { stdio: 'inherit', env: process.env, windowsHide: true });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, `${check} failed against PostgreSQL`);
  }
  console.log('PostgreSQL acceptance passed: rollback, exact money, roles, invoices, receiving, QC, returns, payments and restart persistence.');
} finally {
  await clean();
  await db.close();
}
