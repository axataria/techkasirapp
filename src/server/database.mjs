import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
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

  const { createDatabase: postgres } = await import('./postgres-database.mjs');
  return postgres({ connectionString });
}
