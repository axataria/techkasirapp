import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createDatabase } from '../../src/server/database.mjs';

const sourcePath = process.argv[2];
if (!sourcePath || !existsSync(resolve(sourcePath))) throw Error('Usage: node --env-file=.env.cloud.local scripts/database/import-sqlite.mjs PATH_TO_STORE_DB');
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required for the PostgreSQL destination');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
const destination = await createDatabase();
const tables = [...readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').matchAll(/CREATE TABLE (\w+)\s*\(/g)]
  .map(([, name]) => name).filter(name => name !== 'schema_version');
const quote = name => `"${name.replaceAll('"', '""')}"`;
let snapshotOpen = false;
const digestRows = rows => rows.map(row => createHash('sha256').update(JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => [key, value === null ? null : String(value)]))).digest('hex')).sort().join('\n');
try {
  if (!source.prepare("SELECT name FROM sqlite_master WHERE name='store_identifier_schema'").get()) {
    throw Error('Open this database with the current local app first so its SQLite migrations are complete.');
  }
  source.exec('BEGIN');
  snapshotOpen = true;
  const counts = await destination.tx(async () => {
    for (const table of tables) {
      if ((await destination.one(`SELECT COUNT(*) AS count FROM ${quote(table)}`)).count !== 0) {
        throw Error(`Destination ${table} is not empty. Import stopped without replacing existing data.`);
      }
    }
    const counts = {};
    for (const table of tables) {
      const columns = source.prepare(`PRAGMA table_info(${quote(table)})`).all().map(column => column.name);
      if (!columns.length) throw Error(`Missing SQLite table ${table}; finish local migrations first.`);
      const fields = columns;
      const read = source.prepare(`SELECT * FROM ${quote(table)}${table === 'v2_policies' ? ' ORDER BY rowid' : ''}`);
      read.setReadBigInts(true);
      const rows = read.all();
      const sql = `INSERT INTO ${quote(table)} (${fields.map(quote).join(',')}) VALUES (${fields.map(() => '?').join(',')})`;
      for (const row of rows) await destination.run(sql, ...fields.map(field => row[field]));
      const imported = await destination.all(`SELECT ${fields.map(quote).join(',')} FROM ${quote(table)}`);
      if (digestRows(rows) !== digestRows(imported)) throw Error(`Data verification failed for ${table}; import rolled back.`);
      counts[table] = rows.length;
    }
    return counts;
  });
  console.log('Import committed. Every imported row was verified; accounts, sessions and IDs were preserved.');
  console.log(JSON.stringify(counts, null, 2));
} finally {
  if (snapshotOpen) source.exec('ROLLBACK');
  source.close();
  await destination.close();
}
