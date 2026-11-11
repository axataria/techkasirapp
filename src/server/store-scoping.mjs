const codeTables = ['units', 'sales', 'service_jobs', 'expenses', 'incomes', 'losses', 'v2_receipts', 'v2_claims', 'v2_customer_returns', 'v2_supplier_returns'];
export async function scopeStoreIdentifiers({
  db,
  one,
  all,
  tx,
  backupPath
}) {
  if (db.dialect !== 'sqlite') return;
  if (await one("SELECT name FROM sqlite_master WHERE name='store_identifier_schema'")) return;
  const tables = [...codeTables.map(table => [table, 'code', 'TEXT NOT NULL UNIQUE', 'TEXT NOT NULL', 'UNIQUE(store_id,code)']), ...['invoices', 'payment_documents'].map(table => [table, 'number', 'TEXT NOT NULL UNIQUE', 'TEXT NOT NULL', 'UNIQUE(store_id,number)']), ['v2_payment_requests', 'request_key', 'TEXT PRIMARY KEY', 'TEXT NOT NULL', 'PRIMARY KEY(store_id,request_key)']];
  if (await one('SELECT id FROM stores LIMIT 1')) await db.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
  await db.exec('PRAGMA foreign_keys=OFF; PRAGMA legacy_alter_table=ON;');
  try {
    await tx(async () => {
      if (await one("SELECT name FROM sqlite_master WHERE name='store_identifier_schema'")) return;
      const dependents = [];
      for (const [table, column, oldType, newType, constraint] of tables) {
        const {
          sql
        } = await one("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", table);
        const original = `${column} ${oldType}`;
        if (!sql.includes(original)) throw Error(`Unexpected schema for ${table}.${column}`);
        dependents.push(...(await all("SELECT sql FROM sqlite_master WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL", table)));
        const temporary = `${table}_scoped`;
        const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')')).replace(original, `${column} ${newType}`);
        await db.exec(`CREATE TABLE ${temporary} (${body}, ${constraint});
          INSERT INTO ${temporary} SELECT * FROM ${table};
          DROP TABLE ${table}; ALTER TABLE ${temporary} RENAME TO ${table};`);
      }
      for (const {
        sql
      } of dependents) await db.exec(sql);
      if ((await all('PRAGMA foreign_key_check')).length) throw Error('Store identifier migration failed its foreign key check');
      await db.exec('CREATE TABLE store_identifier_schema(version INTEGER NOT NULL); INSERT INTO store_identifier_schema VALUES(1);');
    });
  } finally {
    await db.exec('PRAGMA legacy_alter_table=OFF; PRAGMA foreign_keys=ON;');
  }
}
