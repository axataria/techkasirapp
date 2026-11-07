import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dataDir = process.env.TECHKASIR_DATA_DIR || join(root, 'data');
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
const one = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const money = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw bad('Jumlah harus bilangan rupiah positif atau nol.'); return n; };
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
function userFor(req) { const token = cookie(req, 'tk_session'); if (!token) return null; return one('SELECT u.id,u.store_id,u.username,u.name,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', hash(token), now()) || null; }
function needUser(req) { const u = userFor(req); if (!u) throw bad('Silakan masuk terlebih dahulu.', 401); return u; }
function needRole(u, roles) { if (!roles.includes(u.role)) throw bad('Akses tidak diizinkan.', 403); }
function bodyOf(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) { reject(bad('Data terlalu besar.', 413)); req.destroy(); } }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(bad('JSON tidak valid.')); } }); }); }
function sessionCookie(req, token) { return `tk_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${req.socket.encrypted ? '; Secure' : ''}`; }
function invoice(storeId, sourceType, sourceId, amount, snapshot) { const id = uid(); run('INSERT INTO invoices VALUES(?,?,?,?,?,?,?,?)', id, storeId, nextNumber(storeId, 'INV'), sourceType, sourceId, amount, JSON.stringify(snapshot), now()); return id; }
function paid(sourceType, sourceId) { const direction=['sale','service','income'].includes(sourceType)?'IN':'OUT'; return Number(one('SELECT COALESCE(SUM(CASE WHEN direction=? THEN amount ELSE -amount END),0) AS total FROM payments WHERE source_type=? AND source_id=?',direction,sourceType,sourceId)?.total || 0); }
function paymentSource(type, id, storeId) {
  if (type === 'sale') { const s = one('SELECT s.*,c.name customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=? AND s.store_id=?', id, storeId); if (!s) throw bad('Penjualan tidak ditemukan.'); return { label: s.code, person: s.customer_name || s.buyer_name, due: s.price_amount - s.discount_amount, direction: 'IN' }; }
  if (type === 'service') { const s = one('SELECT j.*,c.name customer_name,c.phone customer_phone FROM service_jobs j JOIN customers c ON c.id=j.customer_id WHERE j.id=? AND j.store_id=?', id, storeId); if (!s) throw bad('Servis tidak ditemukan.'); if(s.status==='Batal') throw bad('Servis batal tidak dapat menerima pembayaran.'); return { label: s.code, person: s.customer_name, due: s.status === 'Selesai' ? s.part_charge + s.service_charge : s.estimate_amount, direction: 'IN', advance: s.status !== 'Selesai', contact:s.customer_phone }; }
  const map = { unit: ['units', 'code', 'purchase_amount+repair_amount+extra_amount', 'OUT'], expense: ['expenses', 'code', 'amount', 'OUT'], income: ['incomes', 'code', 'amount', 'IN'], loss: ['losses', 'code', 'amount', 'OUT'] };
  const m = map[type]; if (!m) throw bad('Jenis sumber pembayaran tidak valid.');
  const s = one(`SELECT *, ${m[2]} AS due FROM ${m[0]} WHERE id=? AND store_id=?`, id, storeId); if (!s) throw bad('Transaksi tidak ditemukan.');
  return { label: s[m[1]], person: type === 'unit' ? s.supplier : s.description, due: s.due, direction: m[3] };
}
function postPayment(u, b) {
  const type = required(b.sourceType, 'Sumber'); const sourceId = required(b.sourceId, 'Transaksi');
  const source = paymentSource(type, sourceId, u.store_id); const amount = money(b.amount); if (!amount) throw bad('Pembayaran harus lebih dari nol.');
  if (type==='service' && source.advance && source.due===0) throw bad('Isi estimasi servis sebelum menerima DP.');
  if (type==='service' && source.advance && !source.contact) throw bad('Nomor HP pelanggan diperlukan untuk mencatat DP servis.');
  const existing = paid(type, sourceId); if (amount > source.due - existing) throw bad('Pembayaran melebihi sisa tagihan atau estimasi.');
  const method = required(b.method, 'Metode'); if (!['Cash','Transfer','QRIS'].includes(method)) throw bad('Metode tidak valid.');
  const id = uid(), paidOn = date(b.paidOn), invoiceRow = one('SELECT id,number FROM invoices WHERE source_type=? AND source_id=?', type, sourceId);
  run('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, u.store_id, type, sourceId, source.direction, amount, method, paidOn, String(b.reference || ''), u.id, now());
  const kind = source.direction === 'IN' ? (source.advance ? 'Uang muka diterima' : 'Kuitansi pembayaran') : 'Bukti pembayaran';
  const doc = { store: one('SELECT name FROM stores WHERE id=?', u.store_id).name, source: source.label, invoice: invoiceRow?.number || null, person: source.person || '', paidOn, amount, method, reference: String(b.reference || ''), cumulative: existing + amount, remaining: source.due - existing - amount, issuer: u.name, kind };
  const docId = uid(); run('INSERT INTO payment_documents VALUES(?,?,?,?,?,?,?,?)', docId, u.store_id, nextNumber(u.store_id, 'PAY'), id, invoiceRow?.id || null, kind, JSON.stringify(doc), now());
  audit(u, 'payment', id, 'create', `${source.label}: ${amount}`);
  return { id, documentId: docId, remaining: doc.remaining };
}
function reversePayment(u, original, paidOn, reason) {
  const id=uid(), direction=original.direction==='IN'?'OUT':'IN';
  run('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,original.source_type,original.source_id,direction,original.amount,original.method,paidOn,`Koreksi ${original.document_number}: ${reason}`,u.id,now());
  run('INSERT INTO payment_reversals VALUES(?,?,?)',original.id,id,reason);
  const source=paymentSource(original.source_type,original.source_id,u.store_id), cumulative=paid(original.source_type,original.source_id),docId=uid();
  const snap={store:one('SELECT name FROM stores WHERE id=?',u.store_id).name,source:source.label,invoice:original.invoice_id?one('SELECT number FROM invoices WHERE id=?',original.invoice_id)?.number:null,person:source.person||'',paidOn,amount:original.amount,method:original.method,reference:`Membatalkan ${original.document_number}: ${reason}`,cumulative,remaining:source.due-cumulative,issuer:u.name,kind:'Pembatalan pembayaran'};
  run('INSERT INTO payment_documents VALUES(?,?,?,?,?,?,?,?)',docId,u.store_id,nextNumber(u.store_id,'PAY'),id,original.invoice_id,'Pembatalan pembayaran',JSON.stringify(snap),now());
  audit(u,'payment',original.id,'reverse',reason);
  return{id,documentId:docId};
  
}

function serializeCustomer(row) {
  const sales = all(`SELECT s.id,s.code,s.sold_on,s.price_amount-s.discount_amount amount FROM sales s WHERE s.customer_id=? ORDER BY s.sold_on DESC`, row.id).map(x => ({...x,paid:paid('sale',x.id),type:'sale',remaining:x.amount-paid('sale',x.id)}));
  const services = all(`SELECT j.id,j.code,j.received_on,j.status,j.estimate_amount,j.part_charge+j.service_charge amount FROM service_jobs j WHERE j.customer_id=? ORDER BY j.received_on DESC`, row.id).map(x => ({...x,paid:paid('service',x.id),type:'service',remaining:x.status==='Selesai'?x.amount-paid('service',x.id):null}));
  return { ...row, transactions:[...sales,...services], outstanding:sales.reduce((n,x)=>n+x.remaining,0)+services.filter(x=>x.status==='Selesai').reduce((n,x)=>n+x.remaining,0), advances:services.filter(x=>x.status!=='Selesai').reduce((n,x)=>n+x.paid,0) };
}
function dashboard(storeId) {
  const units = all('SELECT u.*,s.id sale_id FROM units u LEFT JOIN sales s ON s.unit_id=u.id WHERE u.store_id=?', storeId);
  const sales = all('SELECT s.* FROM sales s WHERE s.store_id=?', storeId);
  const services = all('SELECT * FROM service_jobs WHERE store_id=?', storeId);
  const sum = (rows, f) => rows.reduce((n, x) => n + f(x), 0);
  const unitRevenue = sum(sales, s => s.price_amount-s.discount_amount);
  const unitCosts = sum(sales, s => s.unit_cost_snapshot+s.sale_cost_amount);
  const serviceDone = services.filter(s=>s.status==='Selesai');
  const serviceRevenue = sum(serviceDone, s=>s.part_charge+s.service_charge);
  const serviceCosts = sum(serviceDone, s=>s.part_unit_cost*s.part_qty+s.technician_cost);
  const expenses = Number(one('SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE store_id=?',storeId).total);
  const incomes = Number(one('SELECT COALESCE(SUM(amount),0) total FROM incomes WHERE store_id=?',storeId).total);
  const losses = Number(one('SELECT COALESCE(SUM(amount),0) total FROM losses WHERE store_id=?',storeId).total);
  const opening = one('SELECT amount FROM opening_balances WHERE store_id=?',storeId);
  const cash = Number(opening?.amount||0)+Number(one(`SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) total FROM payments WHERE store_id=?`,storeId).total);
  const receivables = sum(sales, s=>Math.max(0,s.price_amount-s.discount_amount-paid('sale',s.id)))+sum(serviceDone,s=>Math.max(0,s.part_charge+s.service_charge-paid('service',s.id)));
  return { unitRevenue,serviceRevenue,incomes,totalRevenue:unitRevenue+serviceRevenue+incomes,grossProfit:unitRevenue+serviceRevenue+incomes-unitCosts-serviceCosts,netProfit:unitRevenue+serviceRevenue+incomes-unitCosts-serviceCosts-expenses-losses,expenses,losses,cash,receivables,available:units.filter(u=>!u.sale_id&&u.status==='Siap dijual').length,inProcess:units.filter(u=>!u.sale_id&&u.status!=='Siap dijual'&&u.status!=='Retur').length,inventoryValue:sum(units.filter(u=>!u.sale_id&&u.status!=='Retur'),u=>u.purchase_amount+u.repair_amount+u.extra_amount),openServices:services.filter(s=>!['Selesai','Batal'].includes(s.status)).length };
}
function monthlyReport(storeId, year) {
  const sales=all('SELECT * FROM sales WHERE store_id=?',storeId), services=all('SELECT * FROM service_jobs WHERE store_id=?',storeId), units=all('SELECT u.*,s.sold_on,r.returned_on FROM units u LEFT JOIN sales s ON s.unit_id=u.id LEFT JOIN unit_returns r ON r.unit_id=u.id WHERE u.store_id=?',storeId);
  const expenses=all('SELECT * FROM expenses WHERE store_id=?',storeId), incomes=all('SELECT * FROM incomes WHERE store_id=?',storeId), losses=all('SELECT * FROM losses WHERE store_id=?',storeId);
  const payments=all(`
    SELECT p.* FROM payments p
    WHERE p.store_id=? AND NOT EXISTS (
      SELECT 1 FROM payment_corrections c
      JOIN payment_reversals r ON r.original_payment_id=c.original_payment_id
      WHERE p.id IN (r.original_payment_id, r.reversal_payment_id)
    )
  `,storeId);
  const sum=(rows,fn)=>rows.reduce((n,x)=>n+fn(x),0), opening=one('SELECT * FROM opening_balances WHERE store_id=?',storeId);
  return Array.from({length:12},(_,i)=>{ const month=`${year}-${String(i+1).padStart(2,'0')}`,end=new Date(Date.UTC(year,i+1,0)).toISOString().slice(0,10);
    const sm=sales.filter(x=>x.sold_on.startsWith(month)), jm=services.filter(x=>x.status==='Selesai'&&x.completed_on?.startsWith(month));
    const unitRevenue=sum(sm,x=>x.price_amount-x.discount_amount),serviceRevenue=sum(jm,x=>x.part_charge+x.service_charge),otherIncome=sum(incomes.filter(x=>x.happened_on.startsWith(month)),x=>x.amount);
    const unitCost=sum(sm,x=>x.unit_cost_snapshot+x.sale_cost_amount),serviceCost=sum(jm,x=>x.part_unit_cost*x.part_qty+x.technician_cost),expense=sum(expenses.filter(x=>x.happened_on.startsWith(month)),x=>x.amount),loss=sum(losses.filter(x=>x.happened_on.startsWith(month)),x=>x.amount);
    const cashIn=sum(payments.filter(x=>x.paid_on.startsWith(month)&&x.direction==='IN'),x=>x.amount),cashOut=sum(payments.filter(x=>x.paid_on.startsWith(month)&&x.direction==='OUT'),x=>x.amount);
    const cashToDate=sum(payments.filter(x=>x.paid_on<=end),x=>x.direction==='IN'?x.amount:-x.amount);
    const inventory=sum(units.filter(x=>x.intake_date<=end&&(!x.returned_on||x.returned_on>end)&&(!x.sold_on||x.sold_on>end)),x=>x.purchase_amount+x.repair_amount+x.extra_amount);
    return {month,unitRevenue,serviceRevenue,otherIncome,totalRevenue:unitRevenue+serviceRevenue+otherIncome,unitCost,serviceCost,grossProfit:unitRevenue+serviceRevenue+otherIncome-unitCost-serviceCost,expense,loss,netProfit:unitRevenue+serviceRevenue+otherIncome-unitCost-serviceCost-expense-loss,cashIn,cashOut,closingCash:(opening&&opening.effective_on<=end?opening.amount:0)+cashToDate,inventory};
  });
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function documentHtml(u, type, id) {
  needRole(u,['owner','cashier','service']);
  const table = type==='payment'?'payment_documents':'invoices';
  const row = one(`SELECT * FROM ${table} WHERE id=? AND store_id=?`,id,u.store_id); if(!row) throw bad('Dokumen tidak ditemukan.',404);
  const source = type==='payment' ? one('SELECT p.source_type FROM payments p JOIN payment_documents d ON d.payment_id=p.id WHERE d.id=?',id)?.source_type : row.source_type;
  if (u.role==='cashier' && source!=='sale') throw bad('Akses tidak diizinkan.',403);
  if (u.role==='service' && source!=='service') throw bad('Akses tidak diizinkan.',403);
  const d=JSON.parse(row.snapshot), title=type==='payment'?d.kind:'Invoice';
  const entries=type==='payment'?[['Pelanggan / pihak',d.person],['Transaksi',d.source],['Invoice',d.invoice||'Uang muka'],['Tanggal bayar',d.paidOn],['Metode',d.method],['Referensi',d.reference||'—'],['Pembayaran ini',d.amount],['Total dibayar',d.cumulative],['Sisa',d.remaining],['Petugas',d.issuer]]:[['Pelanggan',d.person],['Transaksi',d.source],['Tanggal',d.date],['Total tagihan',d.amount]];
  const format=v=>typeof v==='number'?`Rp ${new Intl.NumberFormat('id-ID').format(v)}`:esc(v);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)} ${esc(row.number)}</title><style>body{font:16px/1.5 Segoe UI,sans-serif;max-width:720px;margin:40px auto;color:#111}header{border-bottom:2px solid #111;padding-bottom:18px}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin-top:28px}td{padding:10px;border-bottom:1px solid #ddd}td:last-child{text-align:right;font-weight:600}button{padding:10px 16px;margin-top:30px}@media print{button{display:none}body{margin:0}}</style></head><body><header><strong>${esc(d.store)}</strong><h1>${esc(title)}</h1><div>No. ${esc(row.number)}</div></header><table>${entries.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${format(v)}</td></tr>`).join('')}</table><p>Dokumen diterbitkan ${esc(row.issued_at.slice(0,10))}.</p><button onclick="print()">Cetak / Simpan PDF</button></body></html>`;
}

async function api(req,res,url) {
  const method=req.method, path=url.pathname;
  if (method==='GET'&&path==='/api/bootstrap') return json(res,200,{needsSetup:!one('SELECT id FROM users LIMIT 1')});
  if (method==='POST'&&path==='/api/setup') { if(one('SELECT id FROM users LIMIT 1')) throw bad('Toko sudah diatur.',403); const b=await bodyOf(req); const name=required(b.storeName,'Nama toko'), username=required(b.username,'Username').toLowerCase(), pass=required(b.password,'Kata sandi'); if(pass.length<10) throw bad('Kata sandi minimal 10 karakter.'); tx(()=>{ const store=uid(), user=uid(); run('INSERT INTO stores VALUES(?,?,?)',store,name,now()); run('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',user,store,username,required(b.name,'Nama pemilik'),'owner',passwordHash(pass),1,now()); run('INSERT INTO opening_balances VALUES(?,?,?,?,?)',uid(),store,date(b.openingDate||new Date().toISOString().slice(0,10)),money(b.openingAmount||0),now()); }); return json(res,201,{ok:true}); }
  if (method==='POST'&&path==='/api/login') { const b=await bodyOf(req), username=String(b.username||'').trim().toLowerCase(), key=`${req.socket.remoteAddress}:${username}`, previous=loginFailures.get(key), fail=previous&&Date.now()-previous.since<15*60_000?previous:null; if(fail&&fail.count>=5) throw bad('Terlalu banyak percobaan. Coba lagi nanti.',429); const u=one('SELECT * FROM users WHERE username=? AND active=1',username); if(!u||!verifyPassword(String(b.password||''),u.password_hash)) { loginFailures.set(key,{count:(fail?.count||0)+1,since:fail?.since||Date.now()}); throw bad('Username atau kata sandi salah.',401); } loginFailures.delete(key); const token=randomBytes(32).toString('hex'); run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),u.id,new Date(Date.now()+604800000).toISOString(),now()); return json(res,200,{ok:true},{'Set-Cookie':sessionCookie(req,token)}); }
  if (method==='POST'&&path==='/api/logout') { const token=cookie(req,'tk_session'); if(token) run('DELETE FROM sessions WHERE token_hash=?',hash(token)); return json(res,200,{ok:true},{'Set-Cookie':'tk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'}); }
  const u=needUser(req);
  if(method==='GET'&&path==='/api/me') return json(res,200,{id:u.id,name:u.name,role:u.role,store:one('SELECT name FROM stores WHERE id=?',u.store_id).name});
  if(method==='GET'&&path==='/api/dashboard') { needRole(u,['owner']); return json(res,200,dashboard(u.store_id)); }
  if(method==='GET'&&path==='/api/reports') { needRole(u,['owner']); const year=Number(url.searchParams.get('year')||new Date().getFullYear()); if(!Number.isInteger(year)||year<2000||year>2100) throw bad('Tahun laporan tidak valid.'); return json(res,200,{year,months:monthlyReport(u.store_id,year)}); }
  if(method==='GET'&&path==='/api/opening') { needRole(u,['owner']); return json(res,200,one('SELECT * FROM opening_balances WHERE store_id=?',u.store_id)); }
  if(method==='POST'&&path==='/api/opening') { needRole(u,['owner']); const b=await bodyOf(req), amount=money(b.amount), effective=date(b.effectiveOn); tx(()=>{run('UPDATE opening_balances SET amount=?,effective_on=? WHERE store_id=?',amount,effective,u.store_id);audit(u,'opening_balance',u.store_id,'update',`${effective}: ${amount}`);}); return json(res,200,{ok:true}); }
  if(method==='GET'&&path==='/api/customers') return json(res,200,all('SELECT * FROM customers WHERE store_id=? ORDER BY created_at DESC',u.store_id).map(serializeCustomer));
  if(method==='POST'&&path==='/api/customers') { const b=await bodyOf(req), id=uid(); const name=required(b.name,'Nama pelanggan'), phone=String(b.phone||'').replace(/[^\d+]/g,''); run('INSERT INTO customers VALUES(?,?,?,?,?,?)',id,u.store_id,name,phone,String(b.notes||''),now()); audit(u,'customer',id,'create'); return json(res,201,{id}); }
  if(method==='GET'&&path==='/api/units') return json(res,200,all('SELECT u.*,s.id sale_id FROM units u LEFT JOIN sales s ON s.unit_id=u.id WHERE u.store_id=? ORDER BY u.created_at DESC',u.store_id).map(x=>u.role==='owner'?({...x,total_cost:x.purchase_amount+x.repair_amount+x.extra_amount,paid:paid('unit',x.id)}):({id:x.id,code:x.code,category:x.category,model:x.model,specs:x.specs,status:x.status,sale_id:x.sale_id})));
  if(method==='POST'&&path==='/api/units') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(), code=required(b.code,'Kode unit'); if(!['Laptop','HP'].includes(b.category)) throw bad('Kategori tidak valid.'); const status=b.status||'Belum dikerjakan'; if(!['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].includes(status)) throw bad('Status tidak valid.'); tx(()=>{run('INSERT INTO units VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,code,b.category,required(b.model,'Model'),String(b.specs||''),String(b.supplier||''),date(b.intakeDate),money(b.purchaseAmount),money(b.repairAmount||0),money(b.extraAmount||0),money(b.targetAmount||0),status,String(b.notes||''),now());if(status==='Retur')run('INSERT INTO unit_returns VALUES(?,?)',id,b.intakeDate);audit(u,'unit',id,'create');}); return json(res,201,{id}); }
  const unitMatch=path.match(/^\/api\/units\/([^/]+)\/status$/);
  if(method==='PATCH'&&unitMatch) { needRole(u,['owner']); const b=await bodyOf(req), x=one('SELECT * FROM units WHERE id=? AND store_id=?',unitMatch[1],u.store_id); if(!x) throw bad('Unit tidak ditemukan.',404); if(one('SELECT id FROM sales WHERE unit_id=?',x.id)) throw bad('Unit sudah terjual.'); if(x.status==='Retur') throw bad('Unit retur memerlukan koreksi untuk dibuka kembali.'); if(!['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].includes(b.status)) throw bad('Status tidak valid.'); tx(()=>{run('UPDATE units SET status=? WHERE id=?',b.status,x.id);if(b.status==='Retur')run('INSERT INTO unit_returns VALUES(?,?)',x.id,date(b.returnedOn||new Date().toISOString().slice(0,10)));audit(u,'unit',x.id,'status',`${x.status} → ${b.status}`);}); return json(res,200,{ok:true}); }
  if(method==='GET'&&path==='/api/sales') { needRole(u,['owner','cashier']); return json(res,200,all(`SELECT s.*,u.code unit_code,u.model,c.name customer_name,i.id invoice_id,i.number invoice_number FROM sales s JOIN units u ON u.id=s.unit_id LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN invoices i ON i.source_type='sale' AND i.source_id=s.id WHERE s.store_id=? ORDER BY s.created_at DESC`,u.store_id).map(x=>{const result={...x,paid:paid('sale',x.id),remaining:x.price_amount-x.discount_amount-paid('sale',x.id)};if(u.role!=='owner'){delete result.unit_cost_snapshot;delete result.sale_cost_amount;}return result;})); }
  if(method==='POST'&&path==='/api/sales') { needRole(u,['owner','cashier']); const b=await bodyOf(req); const result=tx(()=>{ const unit=one('SELECT * FROM units WHERE id=? AND store_id=?',b.unitId,u.store_id); if(!unit) throw bad('Unit tidak ditemukan.'); if(unit.status!=='Siap dijual'||one('SELECT id FROM sales WHERE unit_id=?',unit.id)) throw bad('Unit belum siap atau sudah terjual.'); const price=money(b.price), discount=money(b.discount||0), saleCost=money(b.saleCost||0), initial=money(b.initialPayment||0); if(discount>price||initial>price-discount) throw bad('Diskon atau pembayaran melebihi harga.'); const customer=b.customerId?one('SELECT * FROM customers WHERE id=? AND store_id=?',b.customerId,u.store_id):null; if((price-discount-initial)>0&&!customer?.phone) throw bad('Pelanggan dengan nomor HP wajib untuk transaksi DP atau belum bayar.'); const id=uid(), code=required(b.code,'ID penjualan'), buyer=customer?.name||String(b.buyerName||''); run('INSERT INTO sales VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,code,unit.id,customer?.id||null,buyer,date(b.soldOn),price,discount,saleCost,unit.purchase_amount+unit.repair_amount+unit.extra_amount,now()); invoice(u.store_id,'sale',id,price-discount,{store:one('SELECT name FROM stores WHERE id=?',u.store_id).name,source:code,person:buyer,date:b.soldOn,amount:price-discount}); audit(u,'sale',id,'create'); if(initial) postPayment(u,{sourceType:'sale',sourceId:id,amount:initial,method:b.method,paidOn:b.soldOn}); return {id}; }); return json(res,201,result); }
  if(method==='GET'&&path==='/api/services') { needRole(u,['owner','service']); return json(res,200,all(`SELECT j.*,c.name customer_name,i.id invoice_id,i.number invoice_number FROM service_jobs j JOIN customers c ON c.id=j.customer_id LEFT JOIN invoices i ON i.source_type='service' AND i.source_id=j.id WHERE j.store_id=? ORDER BY j.created_at DESC`,u.store_id).map(x=>({...x,paid:paid('service',x.id),remaining:x.status==='Selesai'?x.part_charge+x.service_charge-paid('service',x.id):null}))); }
  if(method==='POST'&&path==='/api/services') { needRole(u,['owner','service']); const b=await bodyOf(req), customer=one('SELECT * FROM customers WHERE id=? AND store_id=?',b.customerId,u.store_id); if(!customer) throw bad('Pelanggan wajib dipilih.'); const id=uid(); run('INSERT INTO service_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.store_id,required(b.code,'ID servis'),customer.id,date(b.receivedOn),null,required(b.category,'Kategori'),required(b.model,'Model'),required(b.complaint,'Keluhan'),String(b.partCode||''),money(b.partUnitCost||0),money(b.partQty||0),money(b.partCharge||0),money(b.serviceCharge||0),money(b.technicianCost||0),money(b.estimateAmount||0),'Diterima',String(b.notes||''),now()); audit(u,'service',id,'create'); return json(res,201,{id}); }
  const serviceEdit=path.match(/^\/api\/services\/([^/]+)$/);
  if(method==='PATCH'&&serviceEdit) { needRole(u,['owner','service']); const b=await bodyOf(req),job=one('SELECT * FROM service_jobs WHERE id=? AND store_id=?',serviceEdit[1],u.store_id);if(!job)throw bad('Servis tidak ditemukan.',404);if(['Selesai','Batal'].includes(job.status))throw bad('Servis sudah ditutup.');const estimate=money(b.estimateAmount),partUnitCost=money(b.partUnitCost),partQty=money(b.partQty),partCharge=money(b.partCharge),serviceCharge=money(b.serviceCharge),technicianCost=money(b.technicianCost);if(estimate<paid('service',job.id))throw bad('Estimasi tidak boleh lebih kecil dari DP yang diterima.');tx(()=>{run('UPDATE service_jobs SET estimate_amount=?,part_code=?,part_unit_cost=?,part_qty=?,part_charge=?,service_charge=?,technician_cost=?,notes=? WHERE id=?',estimate,String(b.partCode||''),partUnitCost,partQty,partCharge,serviceCharge,technicianCost,String(b.notes||''),job.id);audit(u,'service',job.id,'edit','Estimasi atau biaya diperbarui');});return json(res,200,{ok:true}); }
  const serviceMatch=path.match(/^\/api\/services\/([^/]+)\/status$/);
  if(method==='PATCH'&&serviceMatch) { needRole(u,['owner','service']); const b=await bodyOf(req); const result=tx(()=>{ const job=one('SELECT j.*,c.name customer_name FROM service_jobs j JOIN customers c ON c.id=j.customer_id WHERE j.id=? AND j.store_id=?',serviceMatch[1],u.store_id); if(!job) throw bad('Servis tidak ditemukan.',404); if(['Selesai','Batal'].includes(job.status)) throw bad('Servis sudah ditutup.'); if(!['Dalam pengerjaan','Menunggu sparepart','Selesai','Batal'].includes(b.status)) throw bad('Status tidak valid.'); if(b.status==='Batal'&&paid('service',job.id)>0) throw bad('DP harus diselesaikan pemilik sebelum pembatalan.'); run('UPDATE service_jobs SET status=?,completed_on=? WHERE id=?',b.status,b.status==='Selesai'?date(b.completedOn):null,job.id); if(b.status==='Selesai') { const amount=job.part_charge+job.service_charge; if(paid('service',job.id)>amount) throw bad('DP melebihi invoice akhir. Perlu koreksi pemilik.'); invoice(u.store_id,'service',job.id,amount,{store:one('SELECT name FROM stores WHERE id=?',u.store_id).name,source:job.code,person:job.customer_name,date:b.completedOn,amount}); } audit(u,'service',job.id,'status',`${job.status} → ${b.status}`); return {ok:true}; }); return json(res,200,result); }
  if(method==='GET'&&path==='/api/payments') return json(res,200,all('SELECT p.*,d.id document_id,d.number document_number,d.kind,d.snapshot,r.reversal_payment_id reversed_by,r.reason correction_reason,origin.number original_document_number FROM payments p JOIN payment_documents d ON d.payment_id=p.id LEFT JOIN payment_reversals r ON r.original_payment_id=p.id LEFT JOIN payment_reversals correction ON correction.reversal_payment_id=p.id LEFT JOIN payment_documents origin ON origin.payment_id=correction.original_payment_id WHERE p.store_id=? ORDER BY p.created_at DESC',u.store_id).filter(x=>u.role==='owner'||x.source_type===(u.role==='cashier'?'sale':'service')).map(({ snapshot, ...row }) => ({ ...row, details: JSON.parse(snapshot) })));
  if(method==='POST'&&path==='/api/payments') { const b=await bodyOf(req); needRole(u,b.sourceType==='sale'?['owner','cashier']:b.sourceType==='service'?['owner','service']:['owner']); const result=tx(()=>postPayment(u,b)); return json(res,201,result); }
  const paymentChange = path.match(/^\/api\/payments\/([^/]+)\/(reverse|correct)$/);
  if (method === 'POST' && paymentChange) {
    needRole(u, ['owner']);
    const b = await bodyOf(req);
    const reason = required(b.reason, 'Alasan koreksi');
    const result = tx(() => {
      const original = one('SELECT p.*, d.invoice_id, d.number document_number FROM payments p JOIN payment_documents d ON d.payment_id=p.id WHERE p.id=? AND p.store_id=?', paymentChange[1], u.store_id);
      if (!original) throw bad('Pembayaran tidak ditemukan.', 404);
      if (one('SELECT 1 FROM payment_reversals WHERE original_payment_id=? OR reversal_payment_id=?', original.id, original.id)) throw bad('Pembayaran sudah dibatalkan atau merupakan pembatalan.');
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
  if(finMap[path.slice(5)]) { const [table]=finMap[path.slice(5)]; if(method==='GET') { needRole(u,['owner']); const type=table==='expenses'?'expense':table==='incomes'?'income':'loss';return json(res,200,all(`SELECT * FROM ${table} WHERE store_id=? ORDER BY created_at DESC`,u.store_id).map(x=>({...x,paid:paid(type,x.id),remaining:x.amount-paid(type,x.id)}))); } if(method==='POST') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(); run(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?)`,id,u.store_id,required(b.code,'ID transaksi'),date(b.happenedOn),required(b.category,'Kategori'),required(b.description,'Deskripsi'),money(b.amount),now()); audit(u,table,id,'create'); return json(res,201,{id}); } }
  if(method==='GET'&&path==='/api/audit') { needRole(u,['owner']); return json(res,200,all('SELECT a.*,u.name actor_name FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.store_id=? ORDER BY a.created_at DESC LIMIT 300',u.store_id)); }
  if(method==='GET'&&path==='/api/users') { needRole(u,['owner']); return json(res,200,all('SELECT id,username,name,role,active FROM users WHERE store_id=? ORDER BY created_at',u.store_id)); }
  if(method==='POST'&&path==='/api/users') { needRole(u,['owner']); const b=await bodyOf(req), id=uid(), pass=required(b.password,'Kata sandi'); if(pass.length<10) throw bad('Kata sandi minimal 10 karakter.'); if(!['owner','cashier','service'].includes(b.role)) throw bad('Peran tidak valid.'); run('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',id,u.store_id,required(b.username,'Username').toLowerCase(),required(b.name,'Nama'),b.role,passwordHash(pass),1,now()); audit(u,'user',id,'create'); return json(res,201,{id}); }
  const userMatch=path.match(/^\/api\/users\/([^/]+)\/deactivate$/);
  if(method==='POST'&&userMatch) { needRole(u,['owner']); if(userMatch[1]===u.id) throw bad('Tidak dapat menonaktifkan akun sendiri.'); run('UPDATE users SET active=0 WHERE id=? AND store_id=?',userMatch[1],u.store_id); run('DELETE FROM sessions WHERE user_id=?',userMatch[1]); audit(u,'user',userMatch[1],'deactivate'); return json(res,200,{ok:true}); }
  const resetMatch=path.match(/^\/api\/users\/([^/]+)\/password$/);
  if(method==='POST'&&resetMatch) { needRole(u,['owner']); const b=await bodyOf(req), pass=required(b.password,'Kata sandi');if(pass.length<10) throw bad('Kata sandi minimal 10 karakter.');const target=one('SELECT id FROM users WHERE id=? AND store_id=?',resetMatch[1],u.store_id);if(!target) throw bad('Staf tidak ditemukan.',404);tx(()=>{run('UPDATE users SET password_hash=? WHERE id=?',passwordHash(pass),target.id);run('DELETE FROM sessions WHERE user_id=?',target.id);audit(u,'user',target.id,'password_reset');});return json(res,200,{ok:true}); }
  throw bad('Rute tidak ditemukan.',404);
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{ try { const host=req.headers.host||'localhost'; const url=new URL(req.url,`http://${host}`); if(!['GET','HEAD'].includes(req.method)) { const origin=req.headers.origin; if(origin&&new URL(origin).host!==host) throw bad('Permintaan lintas situs ditolak.',403); }
    if(url.pathname.startsWith('/api/')) return await api(req,res,url);
    if(url.pathname==='/document') { const u=needUser(req), content=documentHtml(u,url.searchParams.get('type'),url.searchParams.get('id')); res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}); return res.end(content); }
    const path=url.pathname==='/'?'/index.html':url.pathname; if(!/^\/[\w.-]+$/.test(path)) throw bad('Tidak ditemukan.',404); const file=join(root,'public',path.slice(1)); const content=readFileSync(file); res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}); res.end(content);
  } catch(e) { if(e.code==='ENOENT') return json(res,404,{error:'Halaman tidak ditemukan.'}); const duplicate=String(e.message).includes('UNIQUE constraint'); json(res,e.status|| (duplicate?409:500),{error:duplicate?'Kode sudah digunakan.':e.status?e.message:'Terjadi kesalahan server.'}); if(!e.status&&!duplicate) console.error(e); } });
const port=Number(process.env.PORT||3000); server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`TechKasir running at http://${process.env.HOST||'127.0.0.1'}:${port}`));
