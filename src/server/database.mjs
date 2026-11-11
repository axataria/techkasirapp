import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publicInteger } from '../../shared/domain.mjs';

const normalizeRow = row => row && Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key, typeof value === 'bigint' ? publicInteger(value) : value]));

// Replace parameter markers only outside SQL strings and quoted identifiers.
export function postgresSql(sql) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\browid\b|\?/g,
    token => token === '?' ? `$${++index}` : token === 'rowid' ? 'created_order' : token);
}

export async function createDatabase({ dataDir, connectionString = process.env.DATABASE_URL } = {}) {
  const context = new AsyncLocalStorage();
  if (!connectionString) {
    if (process.env.K_SERVICE || process.env.TECHKASIR_REQUIRE_POSTGRES === 'true') {
      throw Error('DATABASE_URL is required in cloud deployments; SQLite is local-only.');
    }
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(dataDir, { recursive: true });
    const sqlite = new DatabaseSync(join(dataDir, 'store.db'));
    let pending = Promise.resolve();
    const statement = sql => { const prepared = sqlite.prepare(sql); prepared.setReadBigInts(true); return prepared; };
    const db = {
      dialect: 'sqlite',
      exec: async sql => sqlite.exec(sql),
      one: async (sql, ...args) => normalizeRow(statement(sql).get(...args)),
      all: async (sql, ...args) => statement(sql).all(...args).map(normalizeRow),
      run: async (sql, ...args) => statement(sql).run(...args),
      async request(fn) {
        if (context.getStore()) return fn();
        const previous = pending;
        let release;
        pending = new Promise(resolve => { release = resolve; });
        await previous;
        try { return await context.run({ request: true }, fn); } finally { release(); }
      },
      async tx(fn) {
        return db.request(async () => {
          sqlite.exec('BEGIN IMMEDIATE');
          try { const result = await fn(); sqlite.exec('COMMIT'); return result; }
          catch (error) { sqlite.exec('ROLLBACK'); throw error; }
        });
      },
      close: async () => sqlite.close(),
    };
    return db;
  }

  const { default: pg } = await import('pg');
  const url = new URL(connectionString);
  const schema = process.env.TECHKASIR_DATABASE_SCHEMA || 'techkasir';
  if (!/^techkasir(?:_[a-z0-9_]+)?$/.test(schema)) throw Error('Invalid TechKasir database schema');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  const ca = process.env.DATABASE_CA_CERT || (/\.supabase\.(com|co)$/.test(url.hostname)
    ? readFileSync(new URL('../../scripts/database/supabase-ca.crt', import.meta.url), 'utf8') : undefined);
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
      const result = active.queue.then(() => active.client.query(postgresSql(sql), args));
      active.queue = result.catch(() => {});
      return result;
    }
    const client = await pool.connect();
    try {
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
        await client.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
        // Serialize business writes across Cloud Run instances, including checks
        // before a transaction. This keeps stock, invoices and replay checks atomic.
        if (write) await client.query('SELECT pg_advisory_xact_lock(761482903)');
        const result = await context.run({ client, savepoint: 0, queue: Promise.resolve() }, fn);
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
