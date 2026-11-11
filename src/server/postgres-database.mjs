import { AsyncLocalStorage } from 'node:async_hooks';
import { publicInteger } from '../../shared/domain.mjs';
import { supabaseCa } from './postgres-ca.mjs';
import { environment } from './environment.mjs';

const normalizeRow = row => row && Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key, typeof value === 'bigint' ? publicInteger(value) : value]));

// Replace parameter markers only outside SQL strings and quoted identifiers.
export function postgresSql(sql) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\browid\b|\?/g,
    token => token === '?' ? `$${++index}` : token === 'rowid' ? 'created_order' : token);
}

export async function createDatabase({ connectionString = environment.DATABASE_URL } = {}) {
  if (!connectionString) throw Error('DATABASE_URL is required');
  const context = new AsyncLocalStorage();
  const { default: pg } = await import('pg');
  const url = new URL(connectionString);
  const schema = environment.TECHKASIR_DATABASE_SCHEMA || 'techkasir';
  if (!/^techkasir(?:_[a-z0-9_]+)?$/.test(schema)) throw Error('Invalid TechKasir database schema');
  const role = environment.TECHKASIR_DATABASE_ROLE;
  if (role && role !== 'techkasir_app') throw Error('Invalid TechKasir database role');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  const ca = environment.DATABASE_CA_CERT || (/\.supabase\.(com|co)$/.test(url.hostname)
    ? supabaseCa : undefined);
  // Configure TLS here so URL options cannot silently disable certificate checks.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.href,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    types: { getTypeParser(oid, format) {
      if (format !== 'binary' && [20, 1700].includes(oid)) return value => /^-?\d+$/.test(value) ? BigInt(value) : value;
      return pg.types.getTypeParser(oid, format);
    } },
  });
  pool.on('error', error => console.error('PostgreSQL connection error:', error.code || 'unknown'));
  const query = async (sql, args = []) => {
    const active = context.getStore();
    if (active?.client) {
      const key = active.readCache ? JSON.stringify([sql, args], (_key, value) => typeof value === 'bigint' ? value.toString() : value) : null;
      if (key && active.readCache.has(key)) return active.readCache.get(key);
      const result = active.queue.then(() => active.client.query(postgresSql(sql), args));
      active.queue = result.catch(() => {});
      if (key) active.readCache.set(key, result);
      return result;
    }
    const client = await pool.connect();
    try {
      if (role) await client.query(`SET ROLE ${role}`);
      await client.query(`SET search_path TO ${schema}, pg_catalog`);
      return await client.query(postgresSql(sql), args);
    } finally { client.release(); }
  };
  const db = {
    dialect: 'postgres',
    exec: async sql => query(sql),
    one: async (sql, ...args) => normalizeRow((await query(sql, args)).rows[0]),
    all: async (sql, ...args) => (await query(sql, args)).rows.map(normalizeRow),
    run: async (sql, ...args) => ({ changes: (await query(sql, args)).rowCount }),
    async request(fn, { write = false } = {}) {
      if (context.getStore()?.client) return fn();
      const client = await pool.connect();
      try {
        await client.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        if (role) await client.query(`SET LOCAL ROLE ${role}`);
        await client.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
        // Serialize business writes across Cloud Run instances, including checks
        // before a transaction. This keeps stock, invoices and replay checks atomic.
        if (write) await client.query('SELECT pg_advisory_xact_lock(761482903)');
        const result = await context.run({ client, savepoint: 0, queue: Promise.resolve(), readCache: write ? null : new Map() }, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    async tx(fn) {
      const active = context.getStore();
      if (!active?.client) return db.request(fn, { write: true });
      const savepoint = `business_${++active.savepoint}`;
      await active.client.query(`SAVEPOINT ${savepoint}`);
      try {
        const result = await fn();
        await active.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await active.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await active.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      }
    },
    close: () => pool.end(),
  };
  return db;
}
