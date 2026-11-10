import { createV2 } from './operations.mjs';
import { searchRecords } from './search.mjs';
import { createRecovery } from './recovery.mjs';
import { scopeStoreIdentifiers } from './store-scoping.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { sumMoney, subtractMoney, multiplyMoney, publicInteger, validateTextFields, formatMoney } from '../../shared/domain.mjs';

const root = new URL('../../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dataDir = process.env.TECHKASIR_DATA_DIR || join(root, 'data');
const hostingOrigin = process.env.TECHKASIR_FIREBASE_ORIGIN
  ? new URL(process.env.TECHKASIR_FIREBASE_ORIGIN)
  : null;
if (hostingOrigin && (hostingOrigin.protocol !== 'https:' || hostingOrigin.href !== hostingOrigin.origin + '/')) {
  throw new Error('TECHKASIR_FIREBASE_ORIGIN must be an HTTPS origin.');
}
const sessionCookieName = hostingOrigin ? '__session' : 'tk_session';
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'store.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','cashier','service')), password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS opening_balances (id TEXT PRIMARY KEY, store_id TEXT NOT NULL UNIQUE REFERENCES stores(id), effective_on TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), name TEXT NOT NULL, phone TEXT, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, category TEXT NOT NULL CHECK(category IN ('Laptop','HP')), model TEXT NOT NULL, specs TEXT NOT NULL DEFAULT '', supplier TEXT NOT NULL DEFAULT '', intake_date TEXT NOT NULL, purchase_amount INTEGER NOT NULL CHECK(purchase_amount>=0), repair_amount INTEGER NOT NULL CHECK(repair_amount>=0), extra_amount INTEGER NOT NULL CHECK(extra_amount>=0), target_amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS unit_returns (unit_id TEXT PRIMARY KEY REFERENCES units(id), returned_on TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, unit_id TEXT NOT NULL UNIQUE REFERENCES units(id), customer_id TEXT REFERENCES customers(id), buyer_name TEXT NOT NULL DEFAULT '', sold_on TEXT NOT NULL, price_amount INTEGER NOT NULL, discount_amount INTEGER NOT NULL, sale_cost_amount INTEGER NOT NULL, unit_cost_snapshot INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS service_jobs (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL REFERENCES customers(id), received_on TEXT NOT NULL, completed_on TEXT, category TEXT NOT NULL, model TEXT NOT NULL, complaint TEXT NOT NULL, part_code TEXT NOT NULL DEFAULT '', part_unit_cost INTEGER NOT NULL DEFAULT 0, part_qty INTEGER NOT NULL DEFAULT 0, part_charge INTEGER NOT NULL DEFAULT 0, service_charge INTEGER NOT NULL DEFAULT 0, technician_cost INTEGER NOT NULL DEFAULT 0, estimate_amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Diterima', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, happened_on TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS incomes (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, happened_on TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS losses (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), code TEXT NOT NULL UNIQUE, happened_on TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), source_type TEXT NOT NULL, source_id TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('IN','OUT')), amount INTEGER NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('Cash','Transfer','QRIS')), paid_on TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), number TEXT NOT NULL UNIQUE, source_type TEXT NOT NULL, source_id TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL, snapshot TEXT NOT NULL, issued_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payment_documents (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id), number TEXT NOT NULL UNIQUE, payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id), invoice_id TEXT REFERENCES invoices(id), kind TEXT NOT NULL, snapshot TEXT NOT NULL, issued_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payment_reversals (original_payment_id TEXT PRIMARY KEY REFERENCES payments(id), reversal_payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id), reason TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payment_corrections (original_payment_id TEXT PRIMARY KEY REFERENCES payment_reversals(original_payment_id), replacement_payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id));
CREATE TABLE IF NOT EXISTS counters (store_id TEXT NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(store_id,kind));
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, actor_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source_type,source_id);
CREATE INDEX IF NOT EXISTS idx_service_customer ON service_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
`);

const now = () => new Date().toISOString();
const uid = () => randomUUID();
function readRow(row) {
  return row && Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, typeof value === 'bigint' ? publicInteger(value) : value]));
}
function readStatement(sql) {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  return statement;
}
const one = (sql, ...args) => readRow(readStatement(sql).get(...args));
const all = (sql, ...args) => readStatement(sql).all(...args).map(readRow);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const money = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw bad('Jumlah harus bilangan rupiah positif atau nol.'); return n; };
function storedMoney(value) {
  const exact = BigInt(value);
  if (exact < 0n || exact > 9223372036854775807n) {
    throw bad('Total transaksi melebihi batas rupiah yang dapat disimpan. Kurangi jumlah atau biaya.');
  }
  return value;
}
const date = value => { const v=String(value||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw bad('Tanggal tidak valid.');const parsed=new Date(`${v}T00:00:00Z`);if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==v)throw bad('Tanggal tidak valid.');return v; };
const required = (value, label) => { const v = String(value ?? '').trim(); if (!v) throw bad(`${label} wajib diisi.`); return v; };
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(value).digest('hex');
const loginFailures = new Map();
const passwordHash = value => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`; };
const verifyPassword = (value, stored) => { const [salt, expected] = stored.split(':'); const actual = scryptSync(value, salt, 64); return timingSafeEqual(actual, Buffer.from(expected, 'hex')); };
function tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
function nextNumber(storeId, kind) { run('INSERT INTO counters(store_id,kind,value) VALUES(?,?,0) ON CONFLICT(store_id,kind) DO NOTHING', storeId, kind); run('UPDATE counters SET value=value+1 WHERE store_id=? AND kind=?', storeId, kind); return `${kind}-${String(one('SELECT value FROM counters WHERE store_id=? AND kind=?', storeId, kind).value).padStart(6, '0')}`; }
function audit(user, entity, entityId, action, detail = '') { run('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)', uid(), user.store_id, user.id, entity, entityId, action, detail, now()); }
function json(res, status, body, extra = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }); res.end(JSON.stringify(body)); }
function cookie(req, name) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1); }
function userFor(req) { const token = cookie(req, sessionCookieName); if (!token) return null; return one('SELECT u.id,u.store_id,u.username,u.name,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', hash(token), now()) || null; }
function needUser(req) { const u = userFor(req); if (!u) throw bad('Silakan masuk terlebih dahulu.', 401); return u; }
function needRole(u, roles) { if (!roles.includes(u.role)) throw bad('Akses tidak diizinkan.', 403); }
function bodyOf(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) { reject(bad('Data terlalu besar.', 413)); req.destroy(); }
    });
    req.on('end', () => {
      try {
        let payload;
        try { payload = raw ? JSON.parse(raw) : {}; } catch { throw bad('JSON tidak valid.'); }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw bad('JSON tidak valid.');
        if (req.url.split('?')[0] !== '/api/login') {
          let existing = {};
          const edit = req.url.match(/^\/api\/services\/([^/?]+)$/);
          const user = edit && req.method === 'PATCH' ? userFor(req) : null;
          if (user) {
            const row = one('SELECT notes,part_code FROM service_jobs WHERE id=? AND store_id=?', edit[1], user.store_id);
            if (row) existing = {notes:row.notes, partCode:row.part_code};
          }
          validateTextFields(payload, existing);
        }
        resolve(payload);
      } catch (error) { reject(error); }
    });
  });
}
function sessionCookie(req, token, maxAge = 604800) {
  const secure = hostingOrigin || req.socket.encrypted;
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function invoice(storeId, sourceType, sourceId, amount, snapshot) { const id = uid(); run('INSERT INTO invoices VALUES(?,?,?,?,?,?,?,?)', id, storeId, nextNumber(storeId, 'INV'), sourceType, sourceId, storedMoney(amount), JSON.stringify(snapshot), now()); return id; }
function paid(sourceType, sourceId) { const direction=['sale','service','income','supplier_refund'].includes(sourceType)?'IN':'OUT'; return (one('SELECT COALESCE(SUM(CASE WHEN direction=? THEN amount ELSE -amount END),0) AS total FROM payments WHERE source_type=? AND source_id=?',direction,sourceType,sourceId)?.total || 0); }
function paymentSource(type, id, storeId) {
  const extra=v2.v2source(type,id,storeId);if(extra)return extra;
  if (type === 'sale') { const s = one('SELECT s.*,c.name customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=? AND s.store_id=?', id, storeId); if (!s) throw bad('Penjualan tidak ditemukan.'); return { label: s.code, person: s.customer_name || s.buyer_name, due: v2.saleDue(s), direction: 'IN' }; }
  if (type === 'service') { const s = one('SELECT j.*,c.name customer_name,c.phone customer_phone FROM service_jobs j JOIN customers c ON c.id=j.customer_id WHERE j.id=? AND j.store_id=?', id, storeId); if (!s) throw bad('Servis tidak ditemukan.'); if(s.status==='Batal') throw bad('Servis batal tidak dapat menerima pembayaran.'); return { label: s.code, person: s.customer_name, due: s.status === 'Selesai' ? sumMoney(s.part_charge, s.service_charge) : s.estimate_amount, direction: 'IN', advance: s.status !== 'Selesai', contact:s.customer_phone }; }
  const map = { unit: ['units', 'code', 'purchase_amount+repair_amount+extra_amount', 'OUT'], expense: ['expenses', 'code', 'amount', 'OUT'], income: ['incomes', 'code', 'amount', 'IN'], loss: ['losses', 'code', 'amount', 'OUT'] };
  const m = map[type]; if (!m) throw bad('Jenis sumber pembayaran tidak valid.');
  const s = one(`SELECT *, ${m[2]} AS due FROM ${m[0]} WHERE id=? AND store_id=?`, id, storeId); if (!s) throw bad('Transaksi tidak ditemukan.');
  const supplierCredit=type==='unit'?one("SELECT amount FROM v2_supplier_returns WHERE unit_id=? AND sent_on IS NOT NULL AND settlement='Pengurangan utang'",id)?.amount||0:0;
  if(type==='unit'&&one('SELECT settlement FROM v2_supplier_returns WHERE unit_id=? AND sent_on IS NOT NULL AND settlement<>?',id,'Pengurangan utang'))throw bad('Unit sudah dikembalikan ke supplier.');
  return { label: s[m[1]], person: type === 'unit' ? s.supplier : s.description, due: subtractMoney(subtractMoney(s.due,supplierCredit),type==='unit'?(one('SELECT covered_amount FROM v2_replacements WHERE unit_id=?',id)?.covered_amount||0):0), direction: m[3] };
}
function postPayment(u, b) {
  const type = required(b.sourceType, 'Sumber'); const sourceId = required(b.sourceId, 'Transaksi');
  const source = paymentSource(type, sourceId, u.store_id); const amount = money(b.amount); if (!amount) throw bad('Pembayaran harus lebih dari nol.');
  if (type==='service' && source.advance && source.due===0) throw bad('Isi estimasi servis sebelum menerima DP.');
  if (type==='service' && source.advance && !source.contact) throw bad('Nomor HP pelanggan diperlukan untuk mencatat DP servis.');
  const existing = paid(type, sourceId); if (BigInt(amount) > BigInt(subtractMoney(source.due, existing))) throw bad('Pembayaran melebihi sisa tagihan atau estimasi.');
  const method = required(b.method, 'Metode'); if (!['Cash','Transfer','QRIS'].includes(method)) throw bad('Metode tidak valid.');
  const id = uid(), paidOn = date(b.paidOn), invoiceRow = one('SELECT id,number FROM invoices WHERE source_type=? AND source_id=?', type, sourceId);
  run('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.store_id, type, sourceId, source.direction, amount, method, paidOn, String(b.reference || ''), u.id, now());
  const kind = source.direction === 'IN' ? (source.advance ? 'Uang muka diterima' : 'Kuitansi pembayaran') : 'Bukti pembayaran';
  const doc = { store: one('SELECT name FROM stores WHERE id=?', u.store_id).name, source: source.label, invoice: invoiceRow?.number || null, person: source.person || '', paidOn, amount, method, reference: String(b.reference || ''), cumulative: sumMoney(existing, amount), remaining: subtractMoney(subtractMoney(source.due, existing), amount), issuer: u.name, kind };
  const docId = uid(); run('INSERT INTO payment_documents VALUES(?,?,?,?,?,?,?,?)', docId, u.store_id, nextNumber(u.store_id, 'PAY'), id, invoiceRow?.id || null, kind, JSON.stringify(doc), now());
  audit(u, 'payment', id, 'create', `${source.label}: ${amount}`);
  return { id, documentId: docId, remaining: doc.remaining };
}
function reversePayment(u, original, paidOn, reason) {
  const id=uid(), direction=original.direction==='IN'?'OUT':'IN';
  run('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,original.source_type,original.source_id,direction,original.amount,original.method,paidOn,`Koreksi ${original.document_number}: ${reason}`,u.id,now());
  run('INSERT INTO payment_reversals VALUES(?,?,?)',original.id,id,reason);
  const source=paymentSource(original.source_type,original.source_id,u.store_id), cumulative=paid(original.source_type,original.source_id),docId=uid();
  const snap={store:one('SELECT name FROM stores WHERE id=?',u.store_id).name,source:source.label,invoice:original.invoice_id?one('SELECT number FROM invoices WHERE id=?',original.invoice_id)?.number:null,person:source.person||'',paidOn,amount:original.amount,method:original.method,reference:`Membatalkan ${original.document_number}: ${reason}`,cumulative,remaining:subtractMoney(source.due, cumulative),issuer:u.name,kind:'Pembatalan pembayaran'};
  run('INSERT INTO payment_documents VALUES(?,?,?,?,?,?,?,?)',docId,u.store_id,nextNumber(u.store_id,'PAY'),id,original.invoice_id,'Pembatalan pembayaran',JSON.stringify(snap),now());
  audit(u,'payment',original.id,'reverse',reason);
  return{id,documentId:docId};
  
}

function serializeCustomer(row,role='owner') {
  const sales = all(`SELECT s.id,s.code,s.sold_on,s.price_amount-s.discount_amount amount FROM sales s WHERE s.customer_id=? ORDER BY s.sold_on DESC`, row.id).map(x => ({...x,paid:paid('sale',x.id),type:'sale',remaining:Math.max(0,Number(subtractMoney(subtractMoney(x.amount,v2.credit(x.id)),paid('sale',x.id))))}));
  const services = all(`SELECT j.id,j.code,j.received_on,j.status,j.estimate_amount,j.part_charge+j.service_charge amount FROM service_jobs j WHERE j.customer_id=? ORDER BY j.received_on DESC`, row.id).map(x => ({...x,paid:paid('service',x.id),type:'service',remaining:x.status==='Selesai'?subtractMoney(x.amount,paid('service',x.id)):null}));
  return { ...row, transactions:[...(role==='service'?[]:sales),...(role==='cashier'?[]:services)], outstanding:sumMoney(sumRows(sales,x=>x.remaining),sumRows(services.filter(x=>x.status==='Selesai'),x=>x.remaining)), advances:sumRows(services.filter(x=>x.status!=='Selesai'),x=>x.paid) };
}
const sumRows = (rows, value) => rows.reduce((total, row) => sumMoney(total, value(row)), 0);
const nonnegative = value => BigInt(value) > 0n ? value : 0;

function dashboard(storeId) {
  const units = all('SELECT u.*,m.serial,s.id sale_id FROM units u LEFT JOIN v2_unit_meta m ON m.unit_id=u.id LEFT JOIN sales s ON s.unit_id=u.id AND NOT EXISTS(SELECT 1 FROM v2_customer_returns cr WHERE cr.sale_id=s.id AND cr.received_on IS NOT NULL) WHERE u.store_id=?', storeId);
  const sales = all('SELECT * FROM sales WHERE store_id=?', storeId);
  const services = all('SELECT * FROM service_jobs WHERE store_id=?', storeId);
  const completed = services.filter(row => row.status === 'Selesai');
  const adj=v2.adjustments(storeId);
  const unitRevenue = subtractMoney(sumRows(sales, row => subtractMoney(row.price_amount, row.discount_amount)),adj.revenue);
  const unitCosts = subtractMoney(sumRows(sales, row => sumMoney(row.unit_cost_snapshot, row.sale_cost_amount)),adj.cost);
  const serviceRevenue = sumRows(completed, row => sumMoney(row.part_charge, row.service_charge));
  const serviceCosts = sumRows(completed, row => sumMoney(multiplyMoney(row.part_unit_cost, row.part_qty), row.technician_cost));
  const expenses = sumRows(all('SELECT amount FROM expenses WHERE store_id=?', storeId), row => row.amount);
  const incomes = sumRows(all('SELECT amount FROM incomes WHERE store_id=?', storeId), row => row.amount);
  const losses = sumRows(all('SELECT amount FROM losses WHERE store_id=?', storeId), row => row.amount);
  const opening = one('SELECT amount FROM opening_balances WHERE store_id=?', storeId);
  const movements = sumRows(all('SELECT amount,direction FROM payments WHERE store_id=?', storeId), row => row.direction === 'IN' ? row.amount : subtractMoney(0, row.amount));
  const receivables = sumMoney(
    sumRows(sales, row => nonnegative(subtractMoney(v2.saleDue(row), paid('sale', row.id)))),
    sumRows(completed, row => nonnegative(subtractMoney(sumMoney(row.part_charge, row.service_charge), paid('service', row.id))))
  );
  const totalRevenue = sumMoney(unitRevenue, serviceRevenue, incomes);
  const grossProfit = subtractMoney(subtractMoney(totalRevenue, unitCosts), serviceCosts);
  return {
    unitRevenue, serviceRevenue, incomes, expenses, losses, receivables, totalRevenue, grossProfit,
    netProfit: subtractMoney(subtractMoney(grossProfit, expenses), losses),
    cash: sumMoney(opening?.amount || 0, movements),
    available: units.filter(row => !row.sale_id && row.status === 'Siap dijual').length,
    inProcess: units.filter(row => !row.sale_id && !['Siap dijual','Retur'].includes(row.status)).length,
    inventoryValue: v2.inventoryAt(storeId,'9999-12-31'),
    openServices: services.filter(row => !['Selesai','Batal'].includes(row.status)).length,
  };
}

function monthlyReport(storeId, year) {
  const sales = all('SELECT * FROM sales WHERE store_id=?', storeId);
  const services = all('SELECT * FROM service_jobs WHERE store_id=?', storeId);
  const units = all('SELECT u.*,s.sold_on,r.returned_on FROM units u LEFT JOIN sales s ON s.unit_id=u.id AND NOT EXISTS(SELECT 1 FROM v2_customer_returns cr WHERE cr.sale_id=s.id AND cr.received_on IS NOT NULL) LEFT JOIN unit_returns r ON r.unit_id=u.id WHERE u.store_id=?', storeId);
  const expenses = all('SELECT * FROM expenses WHERE store_id=?', storeId);
  const incomes = all('SELECT * FROM incomes WHERE store_id=?', storeId);
  const losses = all('SELECT * FROM losses WHERE store_id=?', storeId);
  const payments = all('SELECT p.* FROM payments p WHERE p.store_id=? AND NOT EXISTS (SELECT 1 FROM payment_corrections c JOIN payment_reversals r ON r.original_payment_id=c.original_payment_id WHERE p.id IN (r.original_payment_id,r.reversal_payment_id))', storeId);
  const opening = one('SELECT * FROM opening_balances WHERE store_id=?', storeId);
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(year).padStart(4, '0') + '-' + String(index + 1).padStart(2, '0');
    const endDate = new Date(month + '-01T00:00:00Z');
    endDate.setUTCMonth(endDate.getUTCMonth() + 1, 0);
    const end = endDate.toISOString().slice(0, 10);
    const sold = sales.filter(row => row.sold_on.startsWith(month));
    const completed = services.filter(row => row.status === 'Selesai' && row.completed_on?.startsWith(month));
    const adj=v2.adjustments(storeId,month+'-01',end);
    const unitRevenue = subtractMoney(sumRows(sold, row => subtractMoney(row.price_amount, row.discount_amount)),adj.revenue);
    const serviceRevenue = sumRows(completed, row => sumMoney(row.part_charge, row.service_charge));
    const otherIncome = sumRows(incomes.filter(row => row.happened_on.startsWith(month)), row => row.amount);
    const unitCost = subtractMoney(sumRows(sold, row => sumMoney(row.unit_cost_snapshot, row.sale_cost_amount)),adj.cost);
    const serviceCost = sumRows(completed, row => sumMoney(multiplyMoney(row.part_unit_cost, row.part_qty), row.technician_cost));
    const expense = sumRows(expenses.filter(row => row.happened_on.startsWith(month)), row => row.amount);
    const loss = sumRows(losses.filter(row => row.happened_on.startsWith(month)), row => row.amount);
    const cashIn = sumRows(payments.filter(row => row.paid_on.startsWith(month) && row.direction === 'IN'), row => row.amount);
    const cashOut = sumRows(payments.filter(row => row.paid_on.startsWith(month) && row.direction === 'OUT'), row => row.amount);
    const cashToDate = sumRows(payments.filter(row => row.paid_on <= end), row => row.direction === 'IN' ? row.amount : subtractMoney(0, row.amount));
    const inventory = v2.inventoryAt(storeId,end);
    const totalRevenue = sumMoney(unitRevenue, serviceRevenue, otherIncome);
    const grossProfit = subtractMoney(subtractMoney(totalRevenue, unitCost), serviceCost);
    return {month,unitRevenue,serviceRevenue,otherIncome,totalRevenue,unitCost,serviceCost,grossProfit,expense,loss,
      netProfit: subtractMoney(subtractMoney(grossProfit, expense), loss), cashIn, cashOut,
      closingCash: sumMoney(opening && opening.effective_on <= end ? opening.amount : 0, cashToDate), inventory};
  });
}

function reportYears(storeId, selectedYear) {
  const fields = [['opening_balances','effective_on'],['units','intake_date'],['sales','sold_on'],
    ['service_jobs','received_on'],['service_jobs','completed_on'],['payments','paid_on'],
    ['expenses','happened_on'],['incomes','happened_on'],['losses','happened_on'],['v2_customer_returns','received_on'],['v2_supplier_returns','sent_on']];
  const query = fields.map(([table, field]) => 'SELECT substr(' + field + ',1,4) year FROM ' + table + ' WHERE store_id=? AND ' + field + ' IS NOT NULL').join(' UNION ');
  const years = all(query, ...fields.map(() => storeId)).map(row => Number(row.year));
  const current = Number(new Intl.DateTimeFormat('en', {timeZone:'Asia/Jakarta',year:'numeric'}).format(new Date()));
  return [...new Set([...years, selectedYear, current])].sort((a, b) => b - a);
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function invoiceHtml(row, invoice, preview) {
  const title = invoice.kind || 'Invoice';
  const description = invoice.model || invoice.kind || (row.source_type === 'service' ? 'Servis pelanggan' : 'Penjualan unit');
  const hasDiscount = invoice.price != null && invoice.discount > 0;
  const issuedOn = row.issued_at.slice(0, 10);
  const itemDetails = [invoice.unit, invoice.specs].filter(Boolean).map(value => `<span>${esc(value)}</span>`).join('');
  const fields = [
    ['No. transaksi', invoice.source],
    ['Tanggal transaksi', invoice.date],
    ['Kanal penjualan', invoice.channel],
    ['Invoice asal', invoice.original],
  ].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('');
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} ${esc(row.number)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#f4f5f5;color:#172420;font:14px/1.45 system-ui,sans-serif}
    main{width:100%;max-width:148mm;min-height:210mm;margin:24px auto 0;padding:clamp(16px,7vw,10mm);background:#fff;overflow-wrap:anywhere}
    body.preview{background:#fff}
    body.preview main{min-height:0;aspect-ratio:148/210;margin:0 auto}
    header{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start;padding:16px 0;border-top:4px solid #08785e;border-bottom:1px solid #b6c7c0;break-inside:avoid}
    header strong{display:block;font-size:16px;margin-top:4px}
    .heading{text-align:right}
    h1{font-size:clamp(22px,6vw,32px);line-height:1.05;letter-spacing:-.035em;margin:0 0 4px}
    .label{display:block;color:#49625a;font-size:11px;font-weight:700;letter-spacing:.075em;text-transform:uppercase}
    .number,.amount{font-variant-numeric:tabular-nums}
    .metadata{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin:24px 0;break-inside:avoid}
    .metadata strong{display:block;margin-top:4px}
    dl{margin:0}
    .references div+div{margin-top:8px}
    dd{margin:2px 0 0}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    tr{break-inside:avoid}
    th,td{padding:10px 8px;vertical-align:top;text-align:left}
    th{background:#eef5f1;border-block:1px solid #b6c7c0}
    th.label{display:table-cell}
    th:last-child{width:38%}
    td{border-bottom:1px solid #b6c7c0}
    .item-details{color:#49625a;font-size:12px}
    .item-details span{display:block;margin-top:2px}
    .amount{text-align:right}
    .totals{margin:16px 0 0 auto;max-width:16rem;break-inside:avoid}
    .totals div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;padding:4px 8px}
    .totals dd{margin:0;font-weight:600;text-align:right}
    .totals .grand-total{margin-top:8px;padding:10px 8px;border-block:1px solid #08785e;background:#eef5f1}
    .grand-total dt{font-weight:700}
    .grand-total dd{font-size:16px}
    footer{margin-top:24px;padding-top:12px;border-top:1px solid #b6c7c0;color:#49625a;font-size:12px;break-inside:avoid}
    footer p{margin:0}
    footer p+p{margin-top:4px}
    .controls{max-width:148mm;margin:12px auto 24px;padding:0 16px}
    button{font:inherit;padding:8px 12px}
    @page{size:A5 portrait;margin:10mm}
    @media print{
      body{background:#fff;font-size:10pt}
      main,body.preview main{width:auto;max-width:none;min-height:0;aspect-ratio:auto;margin:0;padding:0}
      .controls{display:none}
    }
    @media screen and (max-width:360px){
      body{font-size:12px}
      .grand-total dd{font-size:14px}
    }
  </style>
</head>
<body${preview ? ' class="preview"' : ''}><main id="invoice-sheet">
  <header>
    <div><span class="label">Diterbitkan oleh</span><strong>${esc(invoice.store)}</strong></div>
    <div class="heading"><h1>${esc(title)}</h1><div class="number">${esc(row.number)}</div></div>
  </header>
  <section class="metadata" aria-label="Informasi transaksi">
    <div><span class="label">Pelanggan</span><strong>${esc(invoice.person || '—')}</strong></div>
    <dl class="references">${fields}</dl>
  </section>
  <table aria-label="Rincian invoice">
    <thead><tr><th scope="col" class="label">Deskripsi</th><th scope="col" class="label amount">Jumlah</th></tr></thead>
    <tbody><tr>
      <td><strong>${esc(description)}</strong><div class="item-details">${itemDetails}</div></td>
      <td class="amount">${formatMoney(hasDiscount ? invoice.price : invoice.amount)}</td>
    </tr></tbody>
  </table>
  <dl class="totals">
    ${hasDiscount ? `<div><dt>Subtotal</dt><dd>${formatMoney(invoice.price)}</dd></div>
    <div><dt>Diskon</dt><dd>−${formatMoney(invoice.discount)}</dd></div>` : ''}
    <div class="grand-total"><dt>${row.source_type === 'customer_return' ? 'Total kredit' : 'Total tagihan'}</dt><dd class="number">${formatMoney(invoice.amount)}</dd></div>
  </dl>
  <footer>
    ${invoice.model ? `<p><strong>Garansi</strong> · ${esc(invoice.endsOn || 'Tanpa garansi')}</p>` : ''}
    <p>Tanggal terbit · ${esc(issuedOn)}</p>
  </footer>
</main>${preview ? '' : '<div class="controls"><button onclick="print()">Cetak / Simpan PDF</button></div>'}
</body>
</html>`;
}


function documentHtml(u, type, id, preview = false) {
  needRole(u,['owner','cashier','service']);
  const table = type==='payment'?'payment_documents':'invoices';
  const row = one(`SELECT * FROM ${table} WHERE id=? AND store_id=?`,id,u.store_id); if(!row) throw bad('Dokumen tidak ditemukan.',404);
  const source = type==='payment' ? one('SELECT p.source_type FROM payments p JOIN payment_documents d ON d.payment_id=p.id WHERE d.id=?',id)?.source_type : row.source_type;
  if (u.role==='cashier' && !['sale','customer_return','customer_refund'].includes(source)) throw bad('Akses tidak diizinkan.',403);
  if (u.role==='service' && source!=='service') throw bad('Akses tidak diizinkan.',403);
  const d = JSON.parse(row.snapshot);
  if (type !== 'payment') return invoiceHtml(row, d, preview);
  const title = d.kind;
  const entries = [['Pelanggan / pihak',d.person],['Transaksi',d.source],['Invoice',d.invoice||'Uang muka'],['Tanggal bayar',d.paidOn],['Metode',d.method],['Referensi',d.reference||'—'],['Pembayaran ini',d.amount],['Total dibayar',d.cumulative],['Sisa',d.remaining],['Petugas',d.issuer]];
  const format = (value, label) => ['Pembayaran ini','Total dibayar','Sisa'].includes(label) ? formatMoney(value) : esc(value);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)} ${esc(row.number)}</title><style>body{font:16px/1.5 Segoe UI,sans-serif;max-width:720px;margin:40px auto;color:#111}header{border-bottom:2px solid #111;padding-bottom:18px}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin-top:28px}td{padding:10px;border-bottom:1px solid #ddd}td:last-child{text-align:right;font-weight:600}button{padding:10px 16px;margin-top:30px}@media print{button{display:none}body{margin:0}}</style></head><body><header><strong>${esc(d.store)}</strong><h1>${esc(title)}</h1><div>No. ${esc(row.number)}</div></header><table>${entries.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${format(v,k)}</td></tr>`).join('')}</table><p>Dokumen diterbitkan ${esc(row.issued_at.slice(0,10))}.</p><button onclick="print()">Cetak / Simpan PDF</button></body></html>`;
}

const v2=createV2({db,one,all,run,tx,uid,now,date,money,required,bad,needRole,audit,nextNumber,invoice,postPayment,paid,json,bodyOf,sumMoney,subtractMoney,multiplyMoney,storedMoney,validateTextFields,hash,backupPath:join(dataDir,'before-v2-'+Date.now()+'.db')});
scopeStoreIdentifiers({ db, one, all, tx, backupPath: join(dataDir, `before-store-isolation-${uid()}.db`) });
const recovery = createRecovery({ db, one, run, tx, bad, bodyOf, json, needUser, passwordHash, verifyPassword, audit,
  clearLoginFailures: (req, username) => loginFailures.delete(`${req.socket.remoteAddress}:${username}`),
});

async function api(req,res,url) {
  const method=req.method, path=url.pathname;
  if (await recovery.handle(req, res, path)) return;
  if (method==='GET'&&path==='/api/bootstrap') return json(res,200,{needsSetup:!one('SELECT id FROM users LIMIT 1')});
  if (method === 'POST' && (path === '/api/setup' || path === '/api/register')) {
    const firstSetup = path === '/api/setup';
    const body = await bodyOf(req);
    const storeName = required(body.storeName, 'Nama toko');
    const name = required(body.name, 'Nama pemilik');
    const username = required(body.username, 'Username').toLowerCase();
    const password = required(body.password, 'Kata sandi');
    if (password.length < 10) throw bad('Kata sandi minimal 10 karakter.');
    const openingDate = date(body.openingDate || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    const openingAmount = firstSetup || body.openingDate ? money(body.openingAmount ?? 0) : 0;
    const recoveryCode = tx(() => {
      if (firstSetup && one('SELECT id FROM users LIMIT 1')) throw bad('Toko sudah diatur.', 403);
      if (one('SELECT id FROM users WHERE username=?', username)) throw bad('Username sudah digunakan.', 409);
      const storeId = uid();
      const userId = uid();
      run('INSERT INTO stores VALUES(?,?,?)', storeId, storeName, now());
      run('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)', userId, storeId, username, name, 'owner', passwordHash(password), 1, now());
      run('INSERT INTO opening_balances VALUES(?,?,?,?,?)', uid(), storeId, openingDate, openingAmount, now());
      return recovery.issueSavedCode(userId);
    });
    return json(res, 201, { ok: true, username, recoveryCode });
  }
  if (method==='POST'&&path==='/api/login') { const b=await bodyOf(req), username=String(b.username||'').trim().toLowerCase(), key=`${req.socket.remoteAddress}:${username}`, previous=loginFailures.get(key), fail=previous&&Date.now()-previous.since<15*60_000?previous:null; if(fail&&fail.count>=5) throw bad('Terlalu banyak percobaan. Coba lagi nanti.',429); const u=one('SELECT * FROM users WHERE username=? AND active=1',username); if(!u||!verifyPassword(String(b.password||''),u.password_hash)) { loginFailures.set(key,{count:(fail?.count||0)+1,since:fail?.since||Date.now()}); throw bad('Username atau kata sandi salah.',401); } loginFailures.delete(key); const token=randomBytes(32).toString('hex'); run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),u.id,new Date(Date.now()+604800000).toISOString(),now()); return json(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,token)}); }
  if (method==='POST'&&path==='/api/logout') { const token=cookie(req,sessionCookieName); if(token) run('DELETE FROM sessions WHERE token_hash=?',hash(token)); return json(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,'',0)}); }
  const u=needUser(req);
  if(await v2.handle(req,res,url,u))return;
  if(method==='POST'&&path==='/api/search') {
    const b=await bodyOf(req);
    if(typeof b?.query!=='string'||!b.query.trim()||b.query.length>300) throw bad('Masukkan pencarian sepanjang 1 sampai 300 karakter.');
    const offset=b.offset??0;
    if(!Number.isSafeInteger(offset)||offset<0) throw bad('Halaman pencarian tidak valid.');
    const result=await searchRecords({query:b.query.trim(),offset,role:u.role,includeV2:true,
      read:async scope=>{
        let data;
        await api({method:'GET',headers:req.headers}, {writeHead(status){if(status!==200)throw bad('Pencarian gagal.',status);},end(body){data=JSON.parse(body);}},new URL('/api/'+scope,'http://localhost'));
        return data;
      }
    });
    return json(res,200,result);
  }
  if (path === '/api/me' && (method === 'GET' || method === 'PATCH')) {
    let profile = u;
    if (method === 'PATCH') {
      const body = await bodyOf(req);
      const session = needUser(req);
      const user = one('SELECT * FROM users WHERE id=? AND active=1', session.id);
      const name = required(body.name, 'Nama lengkap');
      const username = required(body.username, 'Username').toLowerCase();
      const key = `profile:${user.id}`;
      const previous = loginFailures.get(key);
      const failures = previous && Date.now() - previous.since < 15 * 60_000 ? previous : null;
      if (failures?.count >= 5) throw bad('Terlalu banyak percobaan. Coba lagi nanti.', 429);
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 256 || !verifyPassword(body.currentPassword, user.password_hash)) {
        loginFailures.set(key, { count: (failures?.count || 0) + 1, since: failures?.since || Date.now() });
        throw bad('Kata sandi saat ini salah.', 403);
      }
      loginFailures.delete(key);
      tx(() => {
        if (one('SELECT id FROM users WHERE username=? AND id<>?', username, user.id)) throw bad('Username sudah digunakan.', 409);
        run('UPDATE users SET name=?, username=? WHERE id=?', name, username, user.id);
        audit(user, 'user', user.id, 'profile_updated');
      });
      profile = { ...session, name, username };
    }
    return json(res, 200, { id: profile.id, name: profile.name, username: profile.username, role: profile.role,
      store: one('SELECT name FROM stores WHERE id=?', profile.store_id).name });
  }
  if(method==='GET'&&path==='/api/dashboard') { needRole(u,['owner']); return json(res,200,dashboard(u.store_id)); }
  if (method === 'GET' && path === '/api/reports') {
    needRole(u, ['owner']);
    const current = new Intl.DateTimeFormat('en', {timeZone:'Asia/Jakarta',year:'numeric'}).format(new Date());
    const year = Number(url.searchParams.get('year') ?? current);
    if (!Number.isInteger(year) || year < 0 || year > 9999) throw bad('Tahun laporan tidak valid.');
    return json(res, 200, {year, years:reportYears(u.store_id,year), months:monthlyReport(u.store_id,year)});
  }
  if(method==='GET'&&path==='/api/opening') { needRole(u,['owner']); return json(res,200,one('SELECT * FROM opening_balances WHERE store_id=?',u.store_id)); }
  if(method==='POST'&&path==='/api/opening') { needRole(u,['owner']); const b=await bodyOf(req), amount=money(b.amount), effective=date(b.effectiveOn); tx(()=>{run('UPDATE opening_balances SET amount=?,effective_on=? WHERE store_id=?',amount,effective,u.store_id);audit(u,'opening_balance',u.store_id,'update',`${effective}: ${amount}`);}); return json(res,200,{ok:true}); }
  if(method==='GET'&&path==='/api/customers') return json(res,200,all('SELECT * FROM customers WHERE store_id=? ORDER BY created_at DESC',u.store_id).map(row=>serializeCustomer(row,u.role)));
  if(method==='POST'&&path==='/api/customers') { const b=await bodyOf(req), id=uid(); const name=required(b.name,'Nama pelanggan'), phone=String(b.phone||'').replace(/[^\d+]/g,''); run('INSERT INTO customers VALUES(?,?,?,?,?,?)',id,u.store_id,name,phone,String(b.notes||''),now()); audit(u,'customer',id,'create'); return json(res,201,{id}); }
  if (method === 'GET' && path === '/api/units') {
    const units = all(`SELECT un.*,m.serial,s.id sale_id,ud.details unit_json,cd.details catalog_json
      FROM units un LEFT JOIN v2_unit_meta m ON m.unit_id=un.id
      LEFT JOIN unit_details ud ON ud.unit_id=un.id
      LEFT JOIN v2_unit_products up ON up.unit_id=un.id LEFT JOIN catalog_details cd ON cd.product_id=up.product_id
      LEFT JOIN sales s ON s.unit_id=un.id AND NOT EXISTS(SELECT 1 FROM v2_customer_returns cr WHERE cr.sale_id=s.id AND cr.received_on IS NOT NULL)
      WHERE un.store_id=? ORDER BY un.created_at DESC`, u.store_id);
    return json(res, 200, units.map(({ unit_json, catalog_json, ...row }) => {
      const unitDetails = JSON.parse(unit_json || '{}');
      const catalogDetails = JSON.parse(catalog_json || '{}');
      if (u.role === 'owner') return { ...row, unitDetails, catalogDetails, total_cost: sumMoney(row.purchase_amount,row.repair_amount,row.extra_amount), paid: paid('unit', row.id), remaining: v2.unitDebt(row) };
      const { id, code, category, model, specs, target_amount, status, sale_id } = row;
      if (u.role === 'cashier') for (const key of ['imei1', 'imei2', 'imeiProof', 'purchaseProof']) delete unitDetails[key];
      return { id, code, category, model, specs, target_amount, status, sale_id, unitDetails, catalogDetails,
        ...(u.role === 'service' ? { serial: row.serial } : {}) };
    }));
  }
  if(method==='POST'&&path==='/api/units') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(), code=required(b.code,'Kode unit'); if(!['Laptop','HP'].includes(b.category)) throw bad('Kategori tidak valid.'); const status=b.status||'Belum dikerjakan'; if(!['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].includes(status)) throw bad('Status tidak valid.'); tx(()=>{run('INSERT INTO units VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,code,b.category,required(b.model,'Model'),String(b.specs||''),String(b.supplier||''),date(b.intakeDate),money(b.purchaseAmount),money(b.repairAmount||0),money(b.extraAmount||0),money(b.targetAmount||0),status,String(b.notes||''),now());if(status==='Retur')run('INSERT INTO unit_returns VALUES(?,?)',id,b.intakeDate);audit(u,'unit',id,'create');}); return json(res,201,{id}); }
  const unitMatch=path.match(/^\/api\/units\/([^/]+)\/status$/);
  if(method==='PATCH'&&unitMatch) { needRole(u,['owner']); const b=await bodyOf(req), x=one('SELECT * FROM units WHERE id=? AND store_id=?',unitMatch[1],u.store_id); if(!x) throw bad('Unit tidak ditemukan.',404); if(v2.activeSale(x.id)) throw bad('Unit sudah terjual.'); if(b.status==='Siap dijual'&&v2.activationHeld(x.id)) throw bad('Selesaikan temuan aktivasi melalui QC.'); if(one('SELECT id FROM v2_receipt_items WHERE unit_id=?',x.id)||one('SELECT id FROM v2_customer_returns cr JOIN sales s ON s.id=cr.sale_id WHERE s.unit_id=? AND cr.received_on IS NOT NULL',x.id))throw bad('Gunakan QC untuk mengubah kelayakan unit v2.'); if(x.status==='Retur') throw bad('Unit retur memerlukan koreksi untuk dibuka kembali.'); if(!['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].includes(b.status)) throw bad('Status tidak valid.'); tx(()=>{run('UPDATE units SET status=? WHERE id=?',b.status,x.id);if(b.status==='Retur')run('INSERT INTO unit_returns VALUES(?,?)',x.id,date(b.returnedOn||new Date().toISOString().slice(0,10)));audit(u,'unit',x.id,'status',`${x.status} → ${b.status}`);}); return json(res,200,{ok:true}); }
  if(method==='GET'&&path==='/api/services') { needRole(u,['owner','service']); return json(res,200,all(`SELECT j.*,c.name customer_name,i.id invoice_id,i.number invoice_number FROM service_jobs j JOIN customers c ON c.id=j.customer_id LEFT JOIN invoices i ON i.source_type='service' AND i.source_id=j.id WHERE j.store_id=? ORDER BY j.created_at DESC`,u.store_id).map(x=>({...x,paid:paid('service',x.id),remaining:x.status==='Selesai'?subtractMoney(sumMoney(x.part_charge,x.service_charge),paid('service',x.id)):null}))); }
  if(method==='POST'&&path==='/api/services') { needRole(u,['owner','service']); const b=await bodyOf(req), customer=one('SELECT * FROM customers WHERE id=? AND store_id=?',b.customerId,u.store_id); if(!customer) throw bad('Pelanggan wajib dipilih.'); const id=uid(); run('INSERT INTO service_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,required(b.code,'ID servis'),customer.id,date(b.receivedOn),null,required(b.category,'Kategori'),required(b.model,'Model'),required(b.complaint,'Keluhan'),String(b.partCode||''),money(b.partUnitCost||0),money(b.partQty||0),money(b.partCharge||0),money(b.serviceCharge||0),money(b.technicianCost||0),money(b.estimateAmount||0),'Diterima',String(b.notes||''),now()); audit(u,'service',id,'create'); return json(res,201,{id}); }
  const serviceEdit=path.match(/^\/api\/services\/([^/]+)$/);
  if(method==='PATCH'&&serviceEdit) { needRole(u,['owner','service']); const b=await bodyOf(req),job=one('SELECT * FROM service_jobs WHERE id=? AND store_id=?',serviceEdit[1],u.store_id);if(!job)throw bad('Servis tidak ditemukan.',404);if(['Selesai','Batal'].includes(job.status))throw bad('Servis sudah ditutup.');const estimate=money(b.estimateAmount),partUnitCost=money(b.partUnitCost),partQty=money(b.partQty),partCharge=money(b.partCharge),serviceCharge=money(b.serviceCharge),technicianCost=money(b.technicianCost);if(estimate<paid('service',job.id))throw bad('Estimasi tidak boleh lebih kecil dari DP yang diterima.');tx(()=>{run('UPDATE service_jobs SET estimate_amount=?,part_code=?,part_unit_cost=?,part_qty=?,part_charge=?,service_charge=?,technician_cost=?,notes=? WHERE id=?',estimate,String(b.partCode||''),partUnitCost,partQty,partCharge,serviceCharge,technicianCost,String(b.notes||''),job.id);audit(u,'service',job.id,'edit','Estimasi atau biaya diperbarui');});return json(res,200,{ok:true}); }
  const serviceMatch=path.match(/^\/api\/services\/([^/]+)\/status$/);
  if(method==='PATCH'&&serviceMatch) { needRole(u,['owner','service']); const b=await bodyOf(req); const result=tx(()=>{ const job=one('SELECT j.*,c.name customer_name FROM service_jobs j JOIN customers c ON c.id=j.customer_id WHERE j.id=? AND j.store_id=?',serviceMatch[1],u.store_id); if(!job) throw bad('Servis tidak ditemukan.',404); if(['Selesai','Batal'].includes(job.status)) throw bad('Servis sudah ditutup.'); if(!['Dalam pengerjaan','Menunggu sparepart','Selesai','Batal'].includes(b.status)) throw bad('Status tidak valid.'); if(b.status==='Batal'&&paid('service',job.id)>0) throw bad('DP harus diselesaikan pemilik sebelum pembatalan.'); run('UPDATE service_jobs SET status=?,completed_on=? WHERE id=?',b.status,b.status==='Selesai'?date(b.completedOn):null,job.id); if(b.status==='Selesai') { const amount=storedMoney(sumMoney(job.part_charge,job.service_charge)); if(paid('service',job.id)>amount) throw bad('DP melebihi invoice akhir. Perlu koreksi pemilik.'); invoice(u.store_id,'service',job.id,amount,{store:one('SELECT name FROM stores WHERE id=?',u.store_id).name,source:job.code,person:job.customer_name,date:b.completedOn,amount}); } audit(u,'service',job.id,'status',`${job.status} → ${b.status}`); return {ok:true}; }); return json(res,200,result); }
  if(method==='GET'&&path==='/api/payments') return json(res,200,all('SELECT p.*,d.id document_id,d.number document_number,d.kind,d.snapshot,r.reversal_payment_id reversed_by,r.reason correction_reason,origin.number original_document_number FROM payments p JOIN payment_documents d ON d.payment_id=p.id LEFT JOIN payment_reversals r ON r.original_payment_id=p.id LEFT JOIN payment_reversals correction ON correction.reversal_payment_id=p.id LEFT JOIN payment_documents origin ON origin.payment_id=correction.original_payment_id WHERE p.store_id=? ORDER BY p.created_at DESC',u.store_id).filter(x=>u.role==='owner'||(u.role==='cashier'?['sale','customer_refund'].includes(x.source_type):x.source_type==='service')).map(({ snapshot, ...row }) => ({ ...row, details: JSON.parse(snapshot) })));
  if(method==='POST'&&path==='/api/payments') { const b=await bodyOf(req); needRole(u,b.sourceType==='sale'?['owner','cashier']:b.sourceType==='service'?['owner','service']:['owner']); const result=tx(()=>{
    if(b.requestKey){const prior=one('SELECT * FROM v2_payment_requests WHERE request_key=? AND store_id=?',b.requestKey,u.store_id);if(prior){if(prior.request_hash!==hash(JSON.stringify(b)))throw bad('Kunci pembayaran sudah dipakai dengan isi berbeda.',409);return JSON.parse(prior.result);}}
    const payment=postPayment(u,b);if(b.requestKey)run('INSERT INTO v2_payment_requests VALUES(?,?,?,?)',b.requestKey,u.store_id,hash(JSON.stringify(b)),JSON.stringify(payment));return payment;
  }); return json(res,201,result); }
  const paymentChange = path.match(/^\/api\/payments\/([^/]+)\/(reverse|correct)$/);
  if (method === 'POST' && paymentChange) {
    needRole(u, ['owner']);
    const b = await bodyOf(req);
    const reason = required(b.reason, 'Alasan koreksi');
    const result = tx(() => {
      const original = one('SELECT p.*, d.invoice_id, d.number document_number FROM payments p JOIN payment_documents d ON d.payment_id=p.id WHERE p.id=? AND p.store_id=?', paymentChange[1], u.store_id);
      if (!original) throw bad('Pembayaran tidak ditemukan.', 404);
      if (one('SELECT 1 FROM payment_reversals WHERE original_payment_id=? OR reversal_payment_id=?', original.id, original.id)) throw bad('Pembayaran sudah dibatalkan atau merupakan pembatalan.');
      if(['customer_refund','supplier_refund'].includes(original.source_type))throw bad('Refund final memerlukan penyesuaian khusus, bukan koreksi pembayaran biasa.');
      if(original.source_type==='sale'&&v2.credit(original.source_id))throw bad('Pembayaran penjualan yang sudah diretur tidak dapat dikoreksi.');
      if (paymentChange[2] === 'reverse') return reversePayment(u, original, date(b.paidOn || new Date().toISOString().slice(0,10)), reason);
      reversePayment(u, original, original.paid_on, reason);
      const replacement = postPayment(u, { ...b, sourceType: original.source_type, sourceId: original.source_id });
      run('INSERT INTO payment_corrections VALUES(?,?)', original.id, replacement.id);
      audit(u, 'payment', original.id, 'correct', replacement.id + ': ' + reason);
      return replacement;
    });
    return json(res, 201, result);
  }
  const finMap={expenses:['expenses','OUT'],incomes:['incomes','IN'],losses:['losses','OUT']};
  if(finMap[path.slice(5)]) { const [table]=finMap[path.slice(5)]; if(method==='GET') { needRole(u,['owner']); const type=table==='expenses'?'expense':table==='incomes'?'income':'loss';return json(res,200,all(`SELECT * FROM ${table} WHERE store_id=? ORDER BY created_at DESC`,u.store_id).map(x=>({...x,paid:paid(type,x.id),remaining:subtractMoney(x.amount,paid(type,x.id))}))); } if(method==='POST') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(); run(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?)`,id,u.store_id,required(b.code,'ID transaksi'),date(b.happenedOn),required(b.category,'Kategori'),required(b.description,'Deskripsi'),money(b.amount),now()); audit(u,table,id,'create'); return json(res,201,{id}); } }
  if(method==='GET'&&path==='/api/audit') { needRole(u,['owner']); return json(res,200,all('SELECT a.*,u.name actor_name FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.store_id=? ORDER BY a.created_at DESC LIMIT 300',u.store_id)); }
  if(method==='GET'&&path==='/api/users') { needRole(u,['owner']); return json(res,200,all('SELECT id,username,name,role,active FROM users WHERE store_id=? ORDER BY created_at',u.store_id)); }
  if(method==='POST'&&path==='/api/users') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(), pass=required(b.password,'Kata sandi'); if(pass.length<10) throw bad('Kata sandi minimal 10 karakter.'); if(!['owner','cashier','service'].includes(b.role)) throw bad('Peran tidak valid.'); run('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',id,u.store_id,required(b.username,'Username').toLowerCase(),required(b.name,'Nama'),b.role,passwordHash(pass),1,now()); audit(u,'user',id,'create'); return json(res,201,{id}); }
  const userMatch=path.match(/^\/api\/users\/([^/]+)\/deactivate$/);
  if(method==='POST'&&userMatch) { needRole(u,['owner']); if(userMatch[1]===u.id) throw bad('Tidak dapat menonaktifkan akun sendiri.'); tx(()=>{ const result=run('UPDATE users SET active=0 WHERE id=? AND store_id=?',userMatch[1],u.store_id); if(!result.changes) throw bad('Staf tidak ditemukan.',404); run('DELETE FROM sessions WHERE user_id=?',userMatch[1]); audit(u,'user',userMatch[1],'deactivate'); }); return json(res,200,{ok:true}); }
  const resetMatch=path.match(/^\/api\/users\/([^/]+)\/password$/);
  if(method==='POST'&&resetMatch) { needRole(u,['owner']); const b=await bodyOf(req), pass=required(b.password,'Kata sandi');if(pass.length<10) throw bad('Kata sandi minimal 10 karakter.');const target=one('SELECT id FROM users WHERE id=? AND store_id=?',resetMatch[1],u.store_id);if(!target) throw bad('Staf tidak ditemukan.',404);tx(()=>{run('UPDATE users SET password_hash=? WHERE id=?',passwordHash(pass),target.id);run('DELETE FROM sessions WHERE user_id=?',target.id);run('DELETE FROM saved_recovery_codes WHERE user_id=?',target.id);run('DELETE FROM recovery_codes WHERE user_id=?',target.id);audit(u,'user',target.id,'password_reset');});return json(res,200,{ok:true}); }
  throw bad('Rute tidak ditemukan.',404);
}

export async function handleStoreRequest(req,res) { try { const host=req.headers.host||'localhost'; const url=new URL(req.url,`http://${host}`); if(!['GET','HEAD'].includes(req.method)) { const origin=req.headers.origin; if(origin && (hostingOrigin ? origin !== hostingOrigin.origin : new URL(origin).host !== host)) throw bad('Permintaan lintas situs ditolak.',403); }
    if(url.pathname.startsWith('/api/')) return await api(req,res,url);
    if(url.pathname==='/document') { const u=needUser(req), content=documentHtml(u,url.searchParams.get('type'),url.searchParams.get('id'),url.searchParams.get('preview')==='1'); res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}); return res.end(content); }
    return json(res,404,{error:'Buka aplikasi melalui server Next.js.'});
  } catch(e) { if(e.code==='ENOENT') return json(res,404,{error:'Halaman tidak ditemukan.'}); const duplicate=String(e.message).includes('UNIQUE constraint'); json(res,e.status|| (duplicate?409:500),{error:duplicate?'Kode sudah digunakan.':e.status?e.message:'Terjadi kesalahan server.'}); if(!e.status&&!duplicate) console.error(e); } }
