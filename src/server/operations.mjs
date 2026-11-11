import { createProductDetails } from "./product-details.mjs";
import { activationHold } from "../../shared/product-fields.mjs";

// V2 extends the existing database and accounting helpers without changing authentication.
export async function createV2(c) {
  const {
    db,
    one,
    all,
    run,
    tx,
    uid,
    now,
    date,
    money,
    required,
    bad,
    needRole,
    audit,
    nextNumber,
    invoice,
    postPayment,
    paid,
    json,
    bodyOf,
    sumMoney,
    subtractMoney
  } = c;
  // Backup is made by SQLite itself so WAL data is included, before the first migration.
  if (db.dialect === 'sqlite' && !(await one("SELECT name FROM sqlite_master WHERE name='v2_schema'"))) {
    const filename = c.backupPath.replaceAll("'", "''");
    await db.exec(`VACUUM INTO '${filename}'`);
    // Remove the old lifetime uniqueness constraint: a returned physical unit can be sold again.
    await db.exec('PRAGMA foreign_keys=OFF');
    try {
      await tx(async () => {
        await db.exec(`CREATE TABLE sales_v2 (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, unit_id TEXT NOT NULL REFERENCES units(id), customer_id TEXT REFERENCES customers(id), buyer_name TEXT NOT NULL DEFAULT '', sold_on TEXT NOT NULL, price_amount INTEGER NOT NULL, discount_amount INTEGER NOT NULL, sale_cost_amount INTEGER NOT NULL, unit_cost_snapshot INTEGER NOT NULL, created_at TEXT NOT NULL);
          INSERT INTO sales_v2 SELECT * FROM sales; DROP TABLE sales; ALTER TABLE sales_v2 RENAME TO sales;
          CREATE INDEX idx_sales_customer ON sales(customer_id); CREATE INDEX idx_sales_unit ON sales(unit_id);
          CREATE TABLE v2_schema(version INTEGER NOT NULL); INSERT INTO v2_schema VALUES(2);`);
      });
    } finally {
      await db.exec('PRAGMA foreign_keys=ON');
    }
    if ((await all('PRAGMA foreign_key_check')).length) throw new Error('V2 migration failed foreign key check. Restore the pre-v2 backup.');
  }
  if (db.dialect === 'sqlite') await db.exec(`
    CREATE TABLE IF NOT EXISTS v2_suppliers(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_receipts(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,code TEXT NOT NULL UNIQUE,supplier_id TEXT NOT NULL REFERENCES v2_suppliers(id),received_on TEXT NOT NULL,status TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_receipt_items(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL REFERENCES v2_receipts(id),unit_id TEXT UNIQUE REFERENCES units(id),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_unit_meta(unit_id TEXT PRIMARY KEY REFERENCES units(id),serial TEXT NOT NULL,store_id TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_serial ON v2_unit_meta(store_id,serial) WHERE serial<>'';
    CREATE TABLE IF NOT EXISTS v2_qc(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,unit_id TEXT NOT NULL REFERENCES units(id),result TEXT NOT NULL,checklist TEXT NOT NULL,notes TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),checked_on TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_policies(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,days INTEGER NOT NULL,terms TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_sale_meta(sale_id TEXT PRIMARY KEY REFERENCES sales(id),channel TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,warranty_days INTEGER NOT NULL,terms TEXT NOT NULL,ends_on TEXT);
    CREATE TABLE IF NOT EXISTS v2_claims(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,code TEXT NOT NULL UNIQUE,sale_id TEXT NOT NULL REFERENCES sales(id),opened_on TEXT NOT NULL,status TEXT NOT NULL,complaint TEXT NOT NULL,resolution TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_customer_returns(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,code TEXT NOT NULL UNIQUE,sale_id TEXT NOT NULL REFERENCES sales(id),opened_on TEXT NOT NULL,received_on TEXT,status TEXT NOT NULL,reason TEXT NOT NULL,credit INTEGER NOT NULL DEFAULT 0,cost_credit INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_customer_return ON v2_customer_returns(sale_id) WHERE status NOT IN ('Ditolak','Dibatalkan');
    CREATE TABLE IF NOT EXISTS v2_supplier_returns(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,code TEXT NOT NULL UNIQUE,unit_id TEXT NOT NULL REFERENCES units(id),opened_on TEXT NOT NULL,sent_on TEXT,status TEXT NOT NULL,reason TEXT NOT NULL,settlement TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_supplier_return ON v2_supplier_returns(unit_id) WHERE status NOT IN ('Ditolak','Dibatalkan');
    CREATE TABLE IF NOT EXISTS v2_movements(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,unit_id TEXT NOT NULL REFERENCES units(id),kind TEXT NOT NULL,source_id TEXT NOT NULL,happened_on TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_payment_requests(request_key TEXT PRIMARY KEY,store_id TEXT NOT NULL,request_hash TEXT NOT NULL,result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_products(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,category TEXT NOT NULL,model TEXT NOT NULL,specs TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS v2_unit_products(unit_id TEXT PRIMARY KEY REFERENCES units(id),product_id TEXT NOT NULL REFERENCES v2_products(id));
    CREATE TABLE IF NOT EXISTS v2_replacements(return_id TEXT PRIMARY KEY REFERENCES v2_supplier_returns(id),unit_id TEXT NOT NULL UNIQUE REFERENCES units(id),covered_amount INTEGER NOT NULL,reference TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS v2_one_active_sale BEFORE INSERT ON sales
    WHEN EXISTS(SELECT 1 FROM sales s WHERE s.unit_id=NEW.unit_id AND NOT EXISTS(SELECT 1 FROM v2_customer_returns r WHERE r.sale_id=s.id AND r.received_on IS NOT NULL))
    BEGIN SELECT RAISE(ABORT,'Unit sudah terjual.'); END;
  `);
  const productDetails = await createProductDetails(c);
  const readUnitDetails = async id => JSON.parse((await one('SELECT details FROM unit_details WHERE unit_id=?', id))?.details || '{}');
  const activationHeld = async id => (await readUnitDetails(id)).activation === activationHold;
  // Legacy units each get their own catalogue entry. Similar model names are never silently merged.
  await tx(async () => {
    for (const un of await all('SELECT * FROM units WHERE id NOT IN (SELECT unit_id FROM v2_unit_products)')) {
      const product = uid();
      await run('INSERT INTO v2_products VALUES(?,?,?,?,?,?,?)', product, un.store_id, un.category, un.model, un.specs, 1, now());
      await run('INSERT INTO v2_unit_products VALUES(?,?)', un.id, product);
    }
  });
  const active = alias => `NOT EXISTS (SELECT 1 FROM v2_customer_returns cr WHERE cr.sale_id=${alias}.id AND cr.received_on IS NOT NULL)`;
  const activeSale = async unitId => await one(`SELECT s.id FROM sales s WHERE s.unit_id=? AND ${active('s')}`, unitId);
  const get = async (table, id, u) => {
    const row = await one(`SELECT * FROM ${table} WHERE id=? AND store_id=?`, id, u.store_id);
    if (!row) throw bad('Data tidak ditemukan.', 404);
    return row;
  };
  const move = async (u, unit, kind, source, day) => await run('INSERT INTO v2_movements VALUES(?,?,?,?,?,?,?,?)', uid(), u.store_id, unit, kind, source, day, u.id, now());
  const policy = async store => (await one('SELECT * FROM v2_policies WHERE store_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1', store)) || {
    days: 0,
    terms: 'Garansi belum ditetapkan.'
  };
  async function credit(saleId) {
    return (await one('SELECT credit FROM v2_customer_returns WHERE sale_id=? AND received_on IS NOT NULL', saleId))?.credit || 0;
  }
  async function saleDue(s) {
    return Math.max(0, Number(subtractMoney(subtractMoney(s.price_amount, s.discount_amount), await credit(s.id))));
  }
  async function refundDue(r) {
    const s = await one('SELECT * FROM sales WHERE id=?', r.sale_id);
    return Math.max(0, Number(await paid('sale', s.id)) - (await saleDue(s)));
  }
  async function unitDebt(un) {
    const r = await one('SELECT * FROM v2_supplier_returns WHERE unit_id=? AND sent_on IS NOT NULL', un.id);
    if (r && r.settlement !== 'Pengurangan utang') return 0;
    const covered = (await one('SELECT covered_amount FROM v2_replacements WHERE unit_id=?', un.id))?.covered_amount || 0;
    const due = subtractMoney(subtractMoney(subtractMoney(sumMoney(un.purchase_amount, un.repair_amount, un.extra_amount), await paid('unit', un.id)), r?.amount || 0), covered);
    return BigInt(due) > 0n ? due : 0;
  }
  async function v2source(type, id, store) {
    if (type === 'customer_refund') {
      const r = await get('v2_customer_returns', id, {
        store_id: store
      });
      if (!r.received_on) throw bad('Retur belum diterima.');
      return {
        label: r.code,
        person: (await one('SELECT buyer_name FROM sales WHERE id=?', r.sale_id))?.buyer_name,
        due: await refundDue(r),
        direction: 'OUT'
      };
    }
    if (type === 'supplier_refund') {
      const r = await get('v2_supplier_returns', id, {
        store_id: store
      });
      if (!r.sent_on || r.settlement !== 'Refund') throw bad('Retur belum dikirim atau bukan refund.');
      return {
        label: r.code,
        person: r.code,
        due: r.amount,
        direction: 'IN'
      };
    }
    return null;
  }
  async function sales(u) {
    needRole(u, ['owner', 'cashier']);
    return (await all(`SELECT s.*,un.code unit_code,un.model,un.specs,c.name customer_name,c.phone customer_phone,i.id invoice_id,i.number invoice_number,m.channel,m.warranty_days,m.terms,m.ends_on,
      COALESCE(p.total,0) paid_total,COALESCE(r.credit,0) return_credit,r.id return_id,r.received_on returned_on
      FROM sales s JOIN units un ON un.id=s.unit_id LEFT JOIN customers c ON c.id=s.customer_id
      LEFT JOIN invoices i ON i.source_id=s.id AND i.source_type='sale' LEFT JOIN v2_sale_meta m ON m.sale_id=s.id
      LEFT JOIN (SELECT source_id,SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END) total FROM payments WHERE store_id=? AND source_type='sale' GROUP BY source_id) p ON p.source_id=s.id
      LEFT JOIN v2_customer_returns r ON r.sale_id=s.id AND r.received_on IS NOT NULL
      WHERE s.store_id=? ORDER BY s.created_at DESC`, u.store_id, u.store_id)).map(({ paid_total, return_credit, ...s }) => {
      const result = {
        ...s,
        channel: s.channel || 'Toko',
        paid: paid_total,
        remaining: Math.max(0, Math.max(0, Number(subtractMoney(subtractMoney(s.price_amount, s.discount_amount), return_credit))) - Number(paid_total)),
        credit: return_credit,
        return_id: s.return_id ?? undefined,
        returned_on: s.returned_on ?? undefined
      };
      if (u.role !== 'owner') {
        delete result.unit_cost_snapshot;
        delete result.sale_cost_amount;
      }
      return result;
    });
  }
  async function receiptRows(u) {
    return await Promise.all((await all('SELECT r.*,s.name supplier_name FROM v2_receipts r JOIN v2_suppliers s ON s.id=r.supplier_id WHERE r.store_id=? ORDER BY r.created_at DESC', u.store_id)).map(async r => ({
      ...r,
      items: (await all('SELECT * FROM v2_receipt_items WHERE receipt_id=?', r.id)).map(i => {
        const data = JSON.parse(i.data);
        if (u.role !== 'owner') for (const k of ['purchaseAmount', 'repairAmount', 'extraAmount']) delete data[k];
        return {
          ...i,
          data
        };
      })
    })));
  }
  async function returnRows(u) {
    return await Promise.all((await all('SELECT r.*,s.code sale_code,s.customer_id,s.unit_id,s.buyer_name,un.model FROM v2_customer_returns r JOIN sales s ON s.id=r.sale_id JOIN units un ON un.id=s.unit_id WHERE r.store_id=? ORDER BY r.created_at DESC', u.store_id)).map(async r => {
      const result = {
        ...r,
        refund_due: r.received_on ? await refundDue(r) : 0,
        refunded: await paid('customer_refund', r.id)
      };
      if (u.role !== 'owner') delete result.cost_credit;
      if (u.role === 'service') {
        delete result.credit;
        delete result.refund_due;
        delete result.refunded;
      }
      return result;
    }));
  }
  async function handle(req, res, url, u) {
    const path = url.pathname,
      method = req.method;
    if (path === '/api/sales' && method === 'GET') {
      json(res, 200, await sales(u));
      return true;
    }
    if (path === '/api/sales' && method === 'POST') {
      needRole(u, ['owner', 'cashier']);
      const b = await bodyOf(req);
      const result = await tx(async () => {
        const requestKey = String(b.requestKey || uid()),
          digest = c.hash(JSON.stringify(b));
        const key = c.hash(JSON.stringify([u.store_id, requestKey]));
        const prior = await one('SELECT m.* FROM v2_sale_meta m JOIN sales s ON s.id=m.sale_id WHERE s.store_id=? AND m.request_key IN (?,?) ORDER BY m.request_key=? DESC LIMIT 1', u.store_id, key, requestKey, key);
        if (prior) {
          if (prior.request_hash !== digest) throw bad('Kunci transaksi sudah dipakai dengan isi berbeda.', 409);
          return {
            id: prior.sale_id
          };
        }
        const un = await get('units', b.unitId, u);
        if (un.status !== 'Siap dijual' || (await activeSale(un.id)) || (await activationHeld(un.id))) throw bad('Unit belum siap atau sudah terjual.');
        const price = money(b.price),
          discount = money(b.discount || 0),
          cost = money(b.saleCost || 0),
          initial = money(b.initialPayment || 0),
          day = date(b.soldOn);
        if (day < un.intake_date) throw bad('Tanggal jual mendahului barang masuk.');
        const lastMove = (await one('SELECT MAX(happened_on) AS "day" FROM v2_movements WHERE unit_id=?', un.id))?.day;
        if (lastMove && day < lastMove) throw bad('Tanggal jual mendahului proses terakhir unit.');
        if (discount > price || initial > price - discount) throw bad('Diskon atau pembayaran melebihi harga.');
        const customer = b.customerId ? await get('customers', b.customerId, u) : null;
        if (price - discount - initial > 0 && !customer?.phone) throw bad('Pelanggan dengan nomor HP wajib untuk transaksi DP atau belum bayar.');
        const channel = b.channel || 'Toko';
        if (!['Toko', 'Marketplace'].includes(channel)) throw bad('Channel tidak valid.');
        const id = uid(),
          code = required(b.code, 'ID penjualan'),
          buyer = customer?.name || String(b.buyerName || '');
        await run('INSERT INTO sales VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, u.store_id, code, un.id, customer?.id || null, buyer, day, price, discount, cost, BigInt(c.storedMoney(sumMoney(un.purchase_amount, un.repair_amount, un.extra_amount))), now());
        const p = await policy(u.store_id),
          end = p.days ? new Date(new Date(day + 'T00:00:00Z').getTime() + p.days * 86400000).toISOString().slice(0, 10) : null;
        await run('INSERT INTO v2_sale_meta VALUES(?,?,?,?,?,?,?)', id, channel, key, digest, p.days, p.terms, end);
        await invoice(u.store_id, 'sale', id, price - discount, {
          store: (await one('SELECT name FROM stores WHERE id=?', u.store_id)).name,
          source: code,
          person: buyer,
          date: day,
          amount: price - discount,
          channel,
          unit: un.code,
          model: un.model,
          specs: un.specs,
          price,
          discount,
          warrantyDays: p.days,
          terms: p.terms,
          endsOn: end
        });
        if (initial) await postPayment(u, {
          sourceType: 'sale',
          sourceId: id,
          amount: initial,
          method: b.method,
          paidOn: day
        });
        await move(u, un.id, 'Penjualan', id, day);
        await audit(u, 'sale', id, 'create', `${channel}: ${price - discount}`);
        return {
          id
        };
      });
      json(res, 201, result);
      return true;
    }
    if (!path.startsWith('/api/v2/')) return false;
    if (!['GET', 'POST'].includes(method) && !(method === 'PATCH' && /^\/api\/v2\/products\/[^/]+$/.test(path))) throw bad('Metode tidak diizinkan.', 405);
    const kind = path.slice(8).split('/')[0],
      id = path.split('/')[4],
      action = path.split('/')[5];
    const owner = () => needRole(u, ['owner']);
    if (kind === 'units' && id && action === 'cost' && method === 'POST') {
      owner();
      const b = await bodyOf(req),
        result = await tx(async () => {
          const un = await get('units', id, u);
          if ((await activeSale(id)) || ['Retur', 'Karantina supplier'].includes(un.status)) throw bad('Biaya hanya dapat ditambahkan ke unit milik toko yang belum terjual.');
          const amount = money(b.amount);
          if (!amount) throw bad('Isi biaya lebih dari nol.');
          const day = date(b.happenedOn),
            reason = required(b.reason, 'Keterangan perbaikan');
          if (day < un.intake_date) throw bad('Biaya mendahului penerimaan.');
          await run('UPDATE units SET repair_amount=? WHERE id=?', BigInt(c.storedMoney(sumMoney(un.repair_amount, amount))), id);
          await audit(u, 'unit', id, 'repair_cost', `${amount}: ${reason}`);
          await move(u, id, 'Biaya perbaikan', id, day);
          return {
            id
          };
        });
      json(res, 201, result);
      return true;
    }
    if (kind === 'products') {
      if (method === 'GET') {
        json(res, 200, await Promise.all((await all('SELECT p.*,c.details FROM v2_products p LEFT JOIN catalog_details c ON c.product_id=p.id WHERE p.store_id=? ORDER BY p.model', u.store_id)).map(async ({
          details,
          ...product
        }) => ({
          ...product,
          catalogDetails: JSON.parse(details || '{}'),
          unit_ids: (await all('SELECT unit_id FROM v2_unit_products WHERE product_id=?', product.id)).map(x => x.unit_id)
        }))));
        return true;
      }
      owner();
      const b = await bodyOf(req);
      const result = await tx(async () => {
        if (method === 'PATCH') {
          const product = await get('v2_products', id, u);
          const details = productDetails.catalog(product.category, b.catalogDetails);
          await run('INSERT INTO catalog_details VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET details=excluded.details', id, JSON.stringify(details));
          await audit(u, 'product', id, 'edit_details');
          return {
            id
          };
        }
        if (id) {
          await get('v2_products', id, u);
          if (![0, 1].includes(b.active)) throw bad('Status produk tidak valid.');
          await run('UPDATE v2_products SET active=? WHERE id=?', b.active, id);
          await audit(u, 'product', id, 'archive', String(b.active));
          return {
            id
          };
        }
        if (!['Laptop', 'HP'].includes(b.category)) throw bad('Kategori tidak valid.');
        const productId = uid();
        await run('INSERT INTO v2_products VALUES(?,?,?,?,?,?,?)', productId, u.store_id, b.category, required(b.model, 'Model'), String(b.specs || ''), 1, now());
        if (b.catalogDetails !== undefined) await run('INSERT INTO catalog_details VALUES(?,?)', productId, JSON.stringify(productDetails.catalog(b.category, b.catalogDetails)));
        await audit(u, 'product', productId, 'create');
        return {
          id: productId
        };
      });
      json(res, 201, result);
      return true;
    }
    if (kind === 'summary' && method === 'GET') {
      owner();
      const from = date(url.searchParams.get('from') || '0000-01-01'),
        to = date(url.searchParams.get('to') || '9999-12-31');
      if (from > to) throw bad('Rentang tanggal terbalik.');
      const inRange = day => day >= from && day <= to;
      const sold = await all('SELECT * FROM sales WHERE store_id=?', u.store_id),
        jobs = await all("SELECT * FROM service_jobs WHERE store_id=? AND status='Selesai'", u.store_id),
        payments = await all('SELECT p.* FROM payments p WHERE p.store_id=? AND NOT EXISTS(SELECT 1 FROM payment_corrections c JOIN payment_reversals r ON r.original_payment_id=c.original_payment_id WHERE p.id IN (r.original_payment_id,r.reversal_payment_id))', u.store_id),
        adj = await adjustments(u.store_id, from, to);
      const sum = async (rows, fn) => {
        let total = 0;
        for (const row of rows) total = sumMoney(total, await fn(row));
        return total;
      };
      const unitRevenue = subtractMoney(await sum(sold.filter(s => inRange(s.sold_on)), s => subtractMoney(s.price_amount, s.discount_amount)), adj.revenue);
      const serviceRevenue = await sum(jobs.filter(s => inRange(s.completed_on)), s => sumMoney(s.part_charge, s.service_charge));
      const unitCost = subtractMoney(await sum(sold.filter(s => inRange(s.sold_on)), s => sumMoney(s.unit_cost_snapshot, s.sale_cost_amount)), adj.cost);
      const serviceCost = await sum(jobs.filter(s => inRange(s.completed_on)), s => sumMoney(c.multiplyMoney(s.part_unit_cost, s.part_qty), s.technician_cost));
      const sourceSum = async table => await sum((await all(`SELECT * FROM ${table} WHERE store_id=?`, u.store_id)).filter(s => inRange(s.happened_on)), s => s.amount);
      const otherIncome = await sourceSum('incomes'),
        expenses = await sourceSum('expenses'),
        losses = await sourceSum('losses');
      const revenue = sumMoney(unitRevenue, serviceRevenue, otherIncome),
        grossProfit = subtractMoney(subtractMoney(revenue, unitCost), serviceCost),
        netProfit = subtractMoney(subtractMoney(grossProfit, expenses), losses);
      const customerReturns = await returnRows(u),
        supplierReturns = await all('SELECT * FROM v2_supplier_returns WHERE store_id=?', u.store_id);
      const receivables = await sum(sold, async s => Math.max(0, (await saleDue(s)) - Number(await paid('sale', s.id))));
      const serviceReceivables = await sum(jobs, async s => Math.max(0, Number(sumMoney(s.part_charge, s.service_charge)) - Number(await paid('service', s.id))));
      const supplierPayables = await sum(await all('SELECT * FROM units WHERE store_id=?', u.store_id), unitDebt);
      json(res, 200, {
        from,
        to,
        unitRevenue,
        serviceRevenue,
        otherIncome,
        revenue,
        unitCost,
        serviceCost,
        grossProfit,
        netProfit,
        expenses,
        losses,
        returnCredit: adj.revenue,
        cashIn: await sum(payments.filter(p => inRange(p.paid_on) && p.direction === 'IN'), p => p.amount),
        cashOut: await sum(payments.filter(p => inRange(p.paid_on) && p.direction === 'OUT'), p => p.amount),
        inventory: await inventoryAt(u.store_id, to),
        currentReceivables: sumMoney(receivables, serviceReceivables),
        currentSupplierPayables: supplierPayables,
        currentRefundLiability: await sum(customerReturns.filter(r => r.received_on), r => Math.max(0, r.refund_due - Number(r.refunded))),
        currentSupplierClaims: await sum(supplierReturns.filter(r => r.sent_on && r.status !== 'Selesai'), async r => r.settlement === 'Refund' ? Math.max(0, r.amount - Number(await paid('supplier_refund', r.id))) : r.settlement === 'Penggantian' ? Number((await one('SELECT purchase_amount FROM units WHERE id=?', r.unit_id)).purchase_amount) : 0),
        pendingQC: (await one("SELECT COUNT(*) n FROM units un WHERE un.store_id=? AND un.status IN ('Menunggu QC','Karantina retur','Dalam perbaikan','Minus / rusak') AND NOT EXISTS(SELECT 1 FROM sales s WHERE s.unit_id=un.id AND " + active('s') + ")", u.store_id)).n,
        openClaims: (await one("SELECT COUNT(*) n FROM v2_claims WHERE store_id=? AND status NOT IN ('Selesai','Ditolak','Dibatalkan')", u.store_id)).n,
        openReturns: customerReturns.filter(r => !['Selesai', 'Ditolak', 'Dibatalkan'].includes(r.status)).length,
        channels: await Promise.all(['Toko', 'Marketplace'].map(async channel => ({
          channel,
          total: await sum((await sales(u)).filter(s => s.channel === channel && inRange(s.sold_on)), s => s.price_amount - s.discount_amount)
        })))
      });
      return true;
    }
    if (kind === 'policy') {
      if (method === 'GET') {
        json(res, 200, await policy(u.store_id));
        return true;
      }
      owner();
      const b = await bodyOf(req),
        days = money(b.days);
      if (days > 3650) throw bad('Durasi maksimal 3650 hari.');
      const result = await tx(async () => {
        const id = uid();
        await run('INSERT INTO v2_policies VALUES(?,?,?,?,?)', id, u.store_id, days, required(b.terms, 'Ketentuan'), now());
        await audit(u, 'warranty_policy', id, 'create', `${days} hari`);
        return {
          id
        };
      });
      json(res, 201, result);
      return true;
    }
    if (kind === 'suppliers') {
      needRole(u, ['owner', 'service']);
      if (method === 'GET') {
        json(res, 200, await all('SELECT * FROM v2_suppliers WHERE store_id=? ORDER BY name', u.store_id));
        return true;
      }
      owner();
      const b = await bodyOf(req),
        id = uid();
      await tx(async () => {
        await run('INSERT INTO v2_suppliers VALUES(?,?,?,?,?)', id, u.store_id, required(b.name, 'Nama supplier'), String(b.phone || ''), now());
        await audit(u, 'supplier', id, 'create');
      });
      json(res, 201, {
        id
      });
      return true;
    }
    if (kind === 'receiving') {
      needRole(u, ['owner', 'service']);
      if (method === 'GET') {
        json(res, 200, await receiptRows(u));
        return true;
      }
      owner();
      const b = await bodyOf(req);
      const result = await tx(async () => {
        if (!id) {
          await get('v2_suppliers', b.supplierId, u);
          const day = date(b.receivedOn),
            items = b.items;
          if (!Array.isArray(items) || !items.length || items.length > 100) throw bad('Isi 1 sampai 100 unit.');
          const receiptId = uid();
          await run('INSERT INTO v2_receipts VALUES(?,?,?,?,?,?,?,?)', receiptId, u.store_id, await nextNumber(u.store_id, 'IN'), b.supplierId, day, 'Draf', String(b.notes || ''), now());
          const receiptImeis = new Set();
          for (const item of items) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw bad('Data unit tidak valid.');
            c.validateTextFields(item);
            item.code = required(item.code, 'Kode unit');
            item.model = required(item.model, 'Model');
            if (!['Laptop', 'HP'].includes(item.category)) throw bad('Kategori tidak valid.');
            if (item.productId) {
              const product = await get('v2_products', item.productId, u);
              if (!product.active) throw bad('Produk sudah diarsipkan.');
              if (product.category !== item.category || product.model !== item.model || product.specs !== String(item.specs || '')) throw bad('Model dan spesifikasi harus cocok dengan produk terpilih.');
            }
            if (item.unitDetails !== undefined) {
              item.unitDetails = productDetails.unit(item.category, item.unitDetails, true);
              for (const imei of [item.unitDetails.imei1, item.unitDetails.imei2].filter(Boolean)) {
                if (receiptImeis.has(imei)) throw bad('IMEI berulang dalam dokumen penerimaan.', 409);
                await productDetails.checkImei(u.store_id, imei);
                receiptImeis.add(imei);
              }
            }
            if (item.catalogDetails !== undefined) item.catalogDetails = productDetails.catalog(item.category, item.catalogDetails);
            for (const k of ['purchaseAmount', 'repairAmount', 'extraAmount', 'targetAmount']) money(item[k] || 0);
            await run('INSERT INTO v2_receipt_items VALUES(?,?,?,?)', uid(), receiptId, null, JSON.stringify(item));
          }
          await audit(u, 'receipt', receiptId, 'create');
          return {
            id: receiptId
          };
        }
        const r = await get('v2_receipts', id, u);
        if (action !== 'finalize') throw bad('Aksi tidak valid.');
        if (r.status === 'Diterima') return {
          id
        };
        const supplier = await get('v2_suppliers', r.supplier_id, u);
        for (const item of await all('SELECT * FROM v2_receipt_items WHERE receipt_id=?', id)) {
          const d = JSON.parse(item.data),
            unit = uid();
          await run('INSERT INTO units VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', unit, u.store_id, d.code, d.category, d.model, String(d.specs || ''), supplier.name, r.received_on, money(d.purchaseAmount || 0), money(d.repairAmount || 0), money(d.extraAmount || 0), money(d.targetAmount || 0), 'Menunggu QC', String(d.notes || ''), now());
          let product = d.productId;
          if (product) {
            if (!(await get('v2_products', product, u)).active) throw bad('Produk sudah diarsipkan.');
          } else {
            product = uid();
            await run('INSERT INTO v2_products VALUES(?,?,?,?,?,?,?)', product, u.store_id, d.category, d.model, String(d.specs || ''), 1, now());
          }
          if (!d.productId && d.catalogDetails) await run('INSERT INTO catalog_details VALUES(?,?)', product, JSON.stringify(d.catalogDetails));
          await run('INSERT INTO v2_unit_products VALUES(?,?)', unit, product);
          const serial = String(d.serial || '').trim();
          if (d.category === 'HP' && /^\d{15}$/.test(serial)) await productDetails.checkImei(u.store_id, serial);
          await run('INSERT INTO v2_unit_meta VALUES(?,?,?)', unit, serial, u.store_id);
          if (d.unitDetails) await productDetails.writeUnit(u.store_id, unit, d.unitDetails);
          await run('UPDATE v2_receipt_items SET unit_id=? WHERE id=?', unit, item.id);
          await move(u, unit, 'Barang masuk', id, r.received_on);
        }
        await run("UPDATE v2_receipts SET status='Diterima' WHERE id=?", id);
        await audit(u, 'receipt', id, 'finalize');
        return {
          id
        };
      });
      json(res, 201, result);
      return true;
    }
    if (kind === 'qc') {
      needRole(u, ['owner', 'service']);
      if (method === 'GET') {
        json(res, 200, await all('SELECT q.*,un.code,un.model,us.name actor_name FROM v2_qc q JOIN units un ON un.id=q.unit_id JOIN users us ON us.id=q.actor_id WHERE q.store_id=? ORDER BY q.created_at DESC', u.store_id));
        return true;
      }
      const b = await bodyOf(req);
      const result = await tx(async () => {
        const un = await get('units', b.unitId, u);
        if ((await activeSale(un.id)) || ['Retur', 'Karantina supplier'].includes(un.status)) throw bad('Unit tidak tersedia untuk QC.');
        if (!['Lulus', 'Perlu perbaikan', 'Gagal'].includes(b.result)) throw bad('Hasil QC tidak valid.');
        const checks = b.checklist;
        if (!checks || typeof checks !== 'object' || !['Identitas', 'Fisik', 'Layar', 'Baterai', 'Input', 'Port', 'Konektivitas', 'Audio/kamera', 'Aksesori', 'Fungsi utama'].every(k => ['Lulus', 'Gagal', 'Tidak berlaku'].includes(checks[k]))) throw bad('Lengkapi semua pemeriksaan.');
        if (b.result === 'Lulus' && Object.values(checks).includes('Gagal')) throw bad('QC gagal tidak dapat dinyatakan lulus.');
        if ((b.result !== 'Lulus' || Object.values(checks).includes('Tidak berlaku')) && !String(b.notes || '').trim()) throw bad('Catatan pemeriksaan wajib diisi.');
        const day = date(b.checkedOn);
        const lastMove = (await one('SELECT MAX(happened_on) AS "day" FROM v2_movements WHERE unit_id=?', un.id))?.day;
        if (lastMove && day < lastMove) throw bad('QC mendahului proses terakhir unit.');
        if (day < un.intake_date) throw bad('QC mendahului penerimaan.');
        const previousDetails = await readUnitDetails(un.id);
        if (b.unitDetails !== undefined && (!b.unitDetails || typeof b.unitDetails !== 'object' || Array.isArray(b.unitDetails))) throw bad('Detail unit tidak valid.');
        const details = b.unitDetails === undefined ? previousDetails : productDetails.unit(un.category, {
          ...previousDetails,
          ...b.unitDetails
        });
        if (b.result === 'Lulus' && details.activation === activationHold) throw bad('Selesaikan temuan bypass atau akun terkunci sebelum unit dinyatakan lulus.');
        if (b.unitDetails !== undefined) await productDetails.writeUnit(u.store_id, un.id, details);
        const id = uid();
        await run('INSERT INTO v2_qc VALUES(?,?,?,?,?,?,?,?,?)', id, u.store_id, un.id, b.result, JSON.stringify(checks), String(b.notes || ''), u.id, day, now());
        await run('UPDATE units SET status=? WHERE id=?', b.result === 'Lulus' ? 'Siap dijual' : b.result === 'Gagal' ? 'Minus / rusak' : 'Dalam perbaikan', un.id);
        await move(u, un.id, `QC ${b.result}`, id, day);
        await audit(u, 'qc', id, 'create', `${un.code}: ${b.result}`);
        return {
          id
        };
      });
      json(res, 201, result);
      return true;
    }
    if (kind === 'warranties') {
      if (method === 'GET') {
        const entitlements = await all(`SELECT s.id,s.code,s.customer_id,s.unit_id,s.sold_on,s.buyer_name,un.model,un.code unit_code,m.warranty_days,m.terms,m.ends_on FROM sales s JOIN units un ON un.id=s.unit_id LEFT JOIN v2_sale_meta m ON m.sale_id=s.id WHERE s.store_id=? ORDER BY s.created_at DESC`, u.store_id);
        json(res, 200, {
          entitlements,
          claims: await all('SELECT c.*,s.code sale_code,un.model FROM v2_claims c JOIN sales s ON s.id=c.sale_id JOIN units un ON un.id=s.unit_id WHERE c.store_id=? ORDER BY c.created_at DESC', u.store_id)
        });
        return true;
      }
      const b = await bodyOf(req),
        result = await tx(async () => {
          if (!id) {
            const s = await get('sales', b.saleId, u),
              m = await one('SELECT * FROM v2_sale_meta WHERE sale_id=?', s.id),
              day = date(b.openedOn);
            if ((await credit(s.id)) || !m?.ends_on || day < s.sold_on || day > m.ends_on) throw bad('Transaksi tidak memiliki hak garansi aktif pada tanggal klaim.');
            const id = uid();
            await run('INSERT INTO v2_claims VALUES(?,?,?,?,?,?,?,?,?)', id, u.store_id, await nextNumber(u.store_id, 'GAR'), s.id, day, 'Diajukan', required(b.complaint, 'Keluhan'), '', now());
            await audit(u, 'warranty_claim', id, 'create');
            return {
              id
            };
          }
          needRole(u, ['owner', 'service']);
          const r = await get('v2_claims', id, u),
            flow = {
              Diajukan: ['Diperiksa', 'Ditolak', 'Dibatalkan'],
              Diperiksa: ['Diproses', 'Ditolak'],
              Diproses: ['Selesai']
            };
          if (!flow[r.status]?.includes(b.status)) throw bad('Perubahan status tidak valid.');
          const resolution = required(b.resolution, 'Hasil/tindakan');
          await run('UPDATE v2_claims SET status=?,resolution=? WHERE id=?', b.status, resolution, id);
          await audit(u, 'warranty_claim', id, 'status', `${r.status} → ${b.status}: ${resolution}`);
          return {
            id
          };
        });
      json(res, 201, result);
      return true;
    }
    if (kind === 'customer-returns') {
      if (method === 'GET' && id && action === 'document') {
        await get('v2_customer_returns', id, u);
        needRole(u, ['owner', 'cashier']);
        const doc = await one("SELECT id FROM invoices WHERE source_type='customer_return' AND source_id=? AND store_id=?", id, u.store_id);
        if (!doc) throw bad('Dokumen belum tersedia.', 404);
        json(res, 200, doc);
        return true;
      }
      if (method === 'GET') {
        json(res, 200, await returnRows(u));
        return true;
      }
      const b = await bodyOf(req),
        result = await tx(async () => {
          if (!id) {
            needRole(u, ['owner', 'cashier']);
            const s = await get('sales', b.saleId, u),
              day = date(b.openedOn);
            if (day < s.sold_on) throw bad('Retur mendahului penjualan.');
            const rid = uid();
            await run('INSERT INTO v2_customer_returns VALUES(?,?,?,?,?,?,?,?,?,?,?)', rid, u.store_id, await nextNumber(u.store_id, 'RPL'), s.id, day, null, 'Diajukan', required(b.reason, 'Alasan'), 0, 0, now());
            await audit(u, 'customer_return', rid, 'create');
            return {
              id: rid
            };
          }
          const r = await get('v2_customer_returns', id, u);
          owner();
          const flow = {
            Diajukan: ['Diperiksa', 'Ditolak', 'Dibatalkan'],
            Diperiksa: ['Disetujui', 'Ditolak'],
            Disetujui: ['Diterima'],
            Diterima: ['Selesai']
          };
          if (!flow[r.status]?.includes(b.status)) throw bad('Perubahan status tidak valid.');
          if (['Ditolak', 'Dibatalkan'].includes(b.status)) required(b.reason, 'Alasan');
          if (b.status === 'Diterima') {
            const s = await get('sales', r.sale_id, u),
              day = date(b.receivedOn);
            if (day < r.opened_on || day < s.sold_on) throw bad('Tanggal penerimaan tidak valid.');
            await run('UPDATE v2_customer_returns SET received_on=?,credit=?,cost_credit=? WHERE id=?', day, s.price_amount - s.discount_amount, s.unit_cost_snapshot, id);
            await run("UPDATE units SET status='Karantina retur' WHERE id=?", s.unit_id);
            await move(u, s.unit_id, 'Retur pelanggan', id, day);
            await invoice(u.store_id, 'customer_return', id, s.price_amount - s.discount_amount, {
              store: (await one('SELECT name FROM stores WHERE id=?', u.store_id)).name,
              source: r.code,
              person: s.buyer_name,
              date: day,
              amount: s.price_amount - s.discount_amount,
              kind: 'Kredit retur',
              original: s.code
            });
          }
          if (b.status === 'Selesai' && Number(await paid('customer_refund', id)) < (await refundDue(r))) throw bad('Selesaikan refund sebelum menutup retur.');
          await run('UPDATE v2_customer_returns SET status=? WHERE id=?', b.status, id);
          await audit(u, 'customer_return', id, 'status', `${r.status} → ${b.status}: ${String(b.reason || '')}`);
          return {
            id
          };
        });
      json(res, 201, result);
      return true;
    }
    if (kind === 'supplier-returns') {
      needRole(u, ['owner', 'service']);
      if (method === 'GET') {
        const rows = await Promise.all((await all('SELECT r.*,un.code unit_code,un.model,un.supplier FROM v2_supplier_returns r JOIN units un ON un.id=r.unit_id WHERE r.store_id=? ORDER BY r.created_at DESC', u.store_id)).map(async r => ({
          ...r,
          refunded: await paid('supplier_refund', r.id)
        })));
        if (u.role !== 'owner') for (const r of rows) {
          delete r.amount;
          delete r.refunded;
        }
        json(res, 200, rows);
        return true;
      }
      owner();
      const b = await bodyOf(req),
        result = await tx(async () => {
          if (!id) {
            const un = await get('units', b.unitId, u);
            if ((await activeSale(un.id)) || un.status === 'Retur') throw bad('Unit sudah terjual/dikembalikan.');
            if (!(await one('SELECT id FROM v2_receipt_items WHERE unit_id=?', un.id))) throw bad('Retur supplier harus terkait barang masuk v2.');
            const day = date(b.openedOn);
            if (day < un.intake_date) throw bad('Retur mendahului barang masuk.');
            const id = uid();
            await run('INSERT INTO v2_supplier_returns VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.store_id, await nextNumber(u.store_id, 'RSP'), un.id, day, null, 'Diajukan', required(b.reason, 'Alasan'), '', 0, now());
            return {
              id
            };
          }
          const r = await get('v2_supplier_returns', id, u),
            flow = {
              Diajukan: ['Disetujui', 'Ditolak', 'Dibatalkan'],
              Disetujui: ['Dikirim', 'Dibatalkan'],
              Dikirim: ['Selesai']
            };
          if (!flow[r.status]?.includes(b.status)) throw bad('Perubahan status tidak valid.');
          if (b.status === 'Disetujui') {
            if (await activeSale(r.unit_id)) throw bad('Unit telah terjual.');
            await run("UPDATE units SET status='Karantina supplier' WHERE id=?", r.unit_id);
          }
          if (b.status === 'Dibatalkan' && r.status === 'Disetujui') await run("UPDATE units SET status='Menunggu QC' WHERE id=?", r.unit_id);
          if (b.status === 'Dikirim') {
            const day = date(b.sentOn);
            if (day < r.opened_on) throw bad('Tanggal kirim tidak valid.');
            if (!['Refund', 'Penggantian', 'Pengurangan utang'].includes(b.settlement)) throw bad('Pilih penyelesaian.');
            const un = await get('units', r.unit_id, u),
              max = Number(sumMoney(un.purchase_amount, un.repair_amount, un.extra_amount)),
              amount = money(b.amount || 0),
              debt = Math.max(0, max - Number(await paid('unit', un.id)));
            if (b.settlement === 'Refund' && amount > Number(await paid('unit', un.id))) throw bad('Refund melebihi pembayaran supplier.');
            if (b.settlement === 'Pengurangan utang' && amount > debt) throw bad('Kredit melebihi utang supplier.');
            await run('UPDATE v2_supplier_returns SET sent_on=?,settlement=?,amount=? WHERE id=?', day, b.settlement, amount, id);
            await run("UPDATE units SET status='Retur' WHERE id=?", r.unit_id);
            await run('INSERT INTO unit_returns VALUES(?,?)', r.unit_id, day);
            await move(u, r.unit_id, 'Retur supplier', id, day);
          }
          if (b.status === 'Selesai') {
            if (r.settlement === 'Refund' && Number(await paid('supplier_refund', id)) < r.amount) throw bad('Catat refund supplier terlebih dahulu.');
            if (r.settlement === 'Penggantian') {
              const item = await one('SELECT i.unit_id,r.status,r.received_on,r.supplier_id FROM v2_receipt_items i JOIN v2_receipts r ON r.id=i.receipt_id WHERE i.unit_id=? AND r.store_id=?', b.replacementUnitId || '', u.store_id),
                original = await one('SELECT r.supplier_id FROM v2_receipt_items i JOIN v2_receipts r ON r.id=i.receipt_id WHERE i.unit_id=?', r.unit_id);
              if (!item || item.status !== 'Diterima' || item.unit_id === r.unit_id || item.received_on < r.sent_on || item.supplier_id !== original?.supplier_id) throw bad('Pilih unit pengganti dari penerimaan baru supplier yang sama setelah tanggal kirim retur.');
              const reference = required(b.reason, 'Referensi penyelesaian'),
                replacement = await get('units', item.unit_id, u),
                oldUnit = await get('units', r.unit_id, u);
              if ((await activeSale(replacement.id)) || replacement.status === 'Retur' || Number(await paid('unit', replacement.id)) > 0) throw bad('Unit pengganti harus belum terjual dan belum dibayar terpisah.');
              const covered = c.storedMoney(sumMoney(oldUnit.purchase_amount, oldUnit.repair_amount, oldUnit.extra_amount));
              await run('UPDATE units SET purchase_amount=? WHERE id=?', BigInt(covered), replacement.id);
              await run('INSERT INTO v2_replacements VALUES(?,?,?,?)', id, item.unit_id, BigInt(covered), reference);
              await audit(u, 'unit', replacement.id, 'replacement_cost', `${replacement.purchase_amount} → ${covered}: ${reference}`);
            }
          }
          await run('UPDATE v2_supplier_returns SET status=? WHERE id=?', b.status, id);
          await audit(u, 'supplier_return', id, 'status', `${r.status} → ${b.status}: ${String(b.reason || '')}`);
          return {
            id
          };
        });
      json(res, 201, result);
      return true;
    }
    if (kind === 'movements' && method === 'GET') {
      const unit = await get('units', url.searchParams.get('unitId'), u);
      json(res, 200, await all('SELECT m.*,us.name actor_name FROM v2_movements m JOIN users us ON us.id=m.actor_id WHERE m.unit_id=? AND m.store_id=? ORDER BY m.created_at DESC', unit.id, u.store_id));
      return true;
    }
    throw bad('Rute v2 tidak ditemukan.', 404);
  }
  async function adjustments(storeId, from = '', end = '9999-12-31') {
    const rows = await all('SELECT credit,cost_credit FROM v2_customer_returns WHERE store_id=? AND received_on>=? AND received_on<=?', storeId, from, end);
    return {
      revenue: rows.reduce((s, r) => sumMoney(s, r.credit), 0),
      cost: rows.reduce((s, r) => sumMoney(s, r.cost_credit), 0)
    };
  }
  async function inventoryAt(storeId, end) {
    return (await all(`SELECT u.* FROM units u WHERE u.store_id=? AND u.intake_date<=? AND NOT EXISTS(SELECT 1 FROM unit_returns r WHERE r.unit_id=u.id AND r.returned_on<=?) AND NOT EXISTS(SELECT 1 FROM sales s WHERE s.unit_id=u.id AND s.sold_on<=? AND NOT EXISTS(SELECT 1 FROM v2_customer_returns r WHERE r.sale_id=s.id AND r.received_on<=?))`, storeId, end, end, end, end)).reduce((s, u) => sumMoney(s, u.purchase_amount, u.repair_amount, u.extra_amount), 0);
  }
  return {
    handle,
    active,
    activeSale,
    activationHeld,
    saleDue,
    credit,
    v2source,
    adjustments,
    inventoryAt,
    refundDue,
    unitDebt
  };
}
