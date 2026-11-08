import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';

// Local development utility. Keep passwords and existing records unchanged;
// use the real API so invoices, receipts, counters and audit entries are exercised.
const root = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dataDir = resolve(process.env.TECHKASIR_DATA_DIR || join(root, 'data'));
const reportPath = join(dataDir, 'dummy-data-report.json');
if (!existsSync(join(dataDir, 'store.db'))) throw Error('Run the app and complete owner setup first.');
const db = new DatabaseSync(join(dataDir, 'store.db'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
const owner = db.prepare("SELECT * FROM users WHERE role='owner' AND active=1 ORDER BY created_at LIMIT 1").get();
if (!owner) throw Error('Complete owner setup before adding dummy data.');
let report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
if (!report) {
  if (db.prepare("SELECT id FROM units WHERE code LIKE 'DUMMY-%' LIMIT 1").get()) {
    throw Error('Partial dummy dataset found. Inspect it before retrying; no records were changed.');
  }
  const backup = join(dataDir, `before-dummy-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  report = { backup, date: '2026-11-07', cases: [], stock: [], financial: [], staff: [], checks: [] };
}
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(tokenHash, owner.id, new Date(Date.now() + 3600000).toISOString(), new Date().toISOString());
const server = spawn(process.execPath, ['scripts/api-test-server.mjs'], { cwd: root, env: { ...process.env, TECHKASIR_DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let base, stderr = '';
server.stderr.on('data', chunk => stderr += chunk);
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: `tk_session=${token}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const value = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(value)}`);
  return value;
}
const post = (path, body) => request('/api/' + path, 'POST', body, 201);
const patch = (path, body) => request('/api/' + path, 'PATCH', body);
const methods = ['Cash', 'Transfer', 'QRIS'];
const date = i => `2026-11-${String(1 + i % 7).padStart(2, '0')}`;
const pay = (type, id, amount, method = 'Transfer', paidOn = report.date) => post('payments', { sourceType: type, sourceId: id, amount, method, paidOn, reference: 'DUMMY - pembayaran pengujian' });
try {
  base = await new Promise((resolveBase, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup timed out: ' + stderr)), 15000);
    server.once('error', e => { clearTimeout(timer); reject(e); });
    server.once('exit', () => { clearTimeout(timer); reject(Error('Server exited: ' + stderr)); });
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolveBase(match[0]); }
    });
  });
  if (!existsSync(reportPath)) {
    const labels = ['Lunas cash', 'Lunas transfer', 'Lunas QRIS', 'Diskon dan DP', 'Belum bayar', 'Cicilan tiga kali', 'Pelunasan DP', 'Koreksi pembayaran', 'Pembatalan pembayaran', 'Diskon 100% / gratis'];
    const names = ['Andi Pratama', 'Siti Rahma', 'Budi Santoso', 'Dewi Lestari', 'Rizky Maulana', 'Nadia Putri', 'Fajar Hidayat', 'Maya & Raka <Test>', 'José Wijaya 日本', 'PT Contoh Pelanggan dengan Nama Panjang untuk Pengujian Invoice'];
    const models = ['ThinkPad T14', 'iPhone 12', 'Dell Latitude 5420', 'Samsung A54', 'MacBook Air M1', 'Redmi Note 13', 'HP EliteBook 840', 'OPPO Reno 8', 'Acer Aspire 5', 'Vivo V27'];
    for (let i = 0; i < 10; i++) {
      const n = String(i + 1).padStart(2, '0');
      const customer = await post('customers', { name: `DUMMY ${names[i]}`, phone: `0800000000${n}`, notes: `Data fiktif pengujian ${n}: ${labels[i]}. Bukan kontak nyata.` });
      const price = 2500000 + i * 150000, discount = i === 9 ? price : i === 3 ? 175000 : 0, total = price - discount;
      const unitBody = { category: i % 2 ? 'HP' : 'Laptop', model: models[i], specs: i % 2 ? '128 GB / RAM 8 GB' : 'Intel i5 / RAM 16 GB / SSD 512 GB', supplier: `DUMMY Supplier ${n}`, intakeDate: date(i), purchaseAmount: 1500000 + i * 50000, repairAmount: i % 3 * 50000, extraAmount: 25000, targetAmount: price, notes: `DUMMY kasus ${n}` };
      const unit = await post('units', { ...unitBody, code: `DUMMY-UNIT-${n}`, status: 'Siap dijual' });
      await pay('unit', unit.id, unitBody.purchaseAmount + unitBody.repairAmount + unitBody.extraAmount, methods[i % 3], date(i));
      const initial = i < 3 ? total : [3, 5, 6, 7, 8].includes(i) ? 500000 : 0;
      const sale = await post('sales', { code: `DUMMY-SALE-${n}`, unitId: unit.id, customerId: customer.id, soldOn: date(i), price, discount, saleCost: 25000, initialPayment: initial, method: methods[i % 3] });
      let remaining = total - initial;
      if (i === 5) { await pay('sale', sale.id, 750000); await pay('sale', sale.id, remaining - 750000, 'QRIS'); remaining = 0; }
      if (i === 6) { await pay('sale', sale.id, remaining); remaining = 0; }
      if (i === 7 || i === 8) {
        const original = (await request('/api/payments')).find(p => p.source_id === sale.id);
        if (i === 7) { await post(`payments/${original.id}/correct`, { paidOn: report.date, amount: 400000, method: 'QRIS', reference: 'DUMMY koreksi metode dan nominal', reason: 'DUMMY salah input 500000 menjadi 400000' }); remaining = total - 400000; }
        else { await post(`payments/${original.id}/reverse`, { paidOn: report.date, reason: 'DUMMY transfer gagal' }); remaining = total; }
      }
      const serviceTotal = i === 5 ? 0 : 350000 + i * 50000;
      const service = await post('services', { code: `DUMMY-SERVICE-${n}`, customerId: customer.id, receivedOn: date(i), category: unitBody.category, model: models[i], complaint: ['Layar pecah', 'Baterai cepat habis', 'Upgrade SSD', 'Keyboard rusak', 'Tidak menyala', 'Diagnosa gratis', 'Port charger rusak', 'Menunggu layar', 'Pemeriksaan awal', 'Dibatalkan pelanggan'][i], partCode: i === 5 ? '' : `DUMMY-PART-${n}`, partUnitCost: i === 5 ? 0 : 100000, partQty: i === 5 ? 0 : 1, partCharge: i === 5 ? 0 : 150000, serviceCharge: i === 5 ? 0 : serviceTotal - 150000, technicianCost: i === 5 ? 0 : 50000, estimateAmount: serviceTotal, notes: `DUMMY kasus servis ${n}` });
      let servicePaid = 0;
      if ([1, 2, 3, 6, 7].includes(i)) { await pay('service', service.id, 100000, methods[i % 3]); servicePaid = 100000; }
      const status = i < 6 ? 'Selesai' : ['Dalam pengerjaan', 'Menunggu sparepart', 'Diterima', 'Batal'][i - 6];
      if (status !== 'Diterima') await patch(`services/${service.id}/status`, { status, completedOn: report.date });
      if ([0, 1, 3].includes(i)) { await pay('service', service.id, serviceTotal - servicePaid, methods[i % 3]); servicePaid = serviceTotal; }
      const stockStatus = ['Siap dijual', 'Belum dikerjakan', 'Dalam perbaikan', 'Menunggu sparepart', 'Minus / rusak', 'Retur'][i % 6];
      const stock = await post('units', { ...unitBody, code: `DUMMY-STOCK-${n}`, status: stockStatus });
      report.stock.push(stock.id);
      for (const [endpoint, type, category, amount] of [['expenses', 'expense', ['Sewa', 'Listrik', 'Internet', 'Transportasi', 'ATK'][i % 5], 50000 + i * 25000], ['incomes', 'income', ['Aksesori', 'Komisi', 'Jasa instalasi'][i % 3], 75000 + i * 10000], ['losses', 'loss', ['Barang rusak', 'Selisih kas', 'Sparepart gagal'][i % 3], 10000 + i * 5000]]) {
        const item = await post(endpoint, { code: `DUMMY-${type.toUpperCase()}-${n}`, happenedOn: date(i), category, description: `DUMMY ${category} kasus ${n}`, amount });
        if (i % 3 !== 2) await pay(type, item.id, i % 3 === 0 ? amount : Math.floor(amount / 2), methods[i % 3], date(i));
        report.financial.push({ id: item.id, endpoint });
      }
      report.cases.push({ case: n, label: labels[i], customerId: customer.id, saleId: sale.id, saleTotal: total, saleRemaining: remaining, serviceId: service.id, serviceStatus: status, serviceTotal, servicePaid });
    }
    const staffPassword = randomBytes(20).toString('base64url');
    for (const role of ['cashier', 'service']) report.staff.push(await post('users', { username: `dummy_${role}`, name: `DUMMY ${role === 'cashier' ? 'Kasir' : 'Teknisi'}`, role, password: staffPassword }));
    // Inactive demo staff populate the staff list without adding usable logins.
    for (const staff of report.staff) await request(`/api/users/${staff.id}/deactivate`, 'POST', {});
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
  const sales = await request('/api/sales'), services = await request('/api/services'), payments = await request('/api/payments');
  report.checks = [];
  const money = n => `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  for (const c of report.cases) {
    const sale = sales.find(s => s.id === c.saleId), service = services.find(s => s.id === c.serviceId);
    assert.equal(sale.remaining, c.saleRemaining); assert.equal(service.status, c.serviceStatus); assert.equal(service.paid, c.servicePaid);
    for (const [row, total] of [[sale, c.saleTotal], ...(c.serviceStatus === 'Selesai' ? [[service, c.serviceTotal]] : [])]) {
      const html = await request(`/document?type=invoice&id=${row.invoice_id}`);
      assert.ok(html.includes(row.invoice_number)); assert.ok(html.includes(money(total))); assert.ok(html.includes(escape(row.customer_name))); assert.ok(html.includes(row.code)); assert.ok(html.includes('onclick="print()"'));
      report.checks.push(`${row.code}: invoice total, customer, number, source, print control OK`);
    }
    if (c.serviceStatus !== 'Selesai') assert.equal(service.invoice_id, null);
    await request('/api/payments', 'POST', { sourceType: 'sale', sourceId: sale.id, amount: sale.remaining + 1, method: 'Cash', paidOn: report.date }, 400);
  }
  const sourceIds = new Set([...report.cases.flatMap(c => [c.saleId, c.serviceId]), ...report.stock, ...report.financial.map(f => f.id), ...db.prepare("SELECT id FROM units WHERE code LIKE 'DUMMY-UNIT-%'").all().map(x => x.id)]);
  const docs = payments.filter(p => sourceIds.has(p.source_id));
  assert.equal(new Set(docs.map(p => p.document_number)).size, docs.length);
  for (const p of docs) {
    const html = await request(`/document?type=payment&id=${p.document_id}`);
    assert.ok(html.includes(p.document_number)); assert.ok(html.includes(money(p.amount))); assert.ok(html.includes(money(p.details.remaining))); assert.ok(html.includes(escape(p.details.kind)));
  }
  const dashboard = await request('/api/dashboard');
  const customers = await request('/api/customers');
  assert.equal(dashboard.receivables, customers.reduce((n, c) => n + c.outstanding, 0));
  await request('/api/reports?year=2026');
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  report.summary = { customers: report.cases.length, units: 20, sales: sales.filter(s => sourceIds.has(s.id)).length, services: services.filter(s => sourceIds.has(s.id)).length, expenses: 10, incomes: 10, losses: 10, demoStaff: report.staff.length, invoicesVerified: report.checks.length, paymentDocumentsVerified: docs.length, overpaymentRejections: 10, databaseIntegrity: 'ok' };
  report.verifiedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report.summary, report: reportPath, backup: report.backup }, null, 2));
} finally {
  db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
  db.close();
  const stopped = once(server, 'exit');
  server.kill();
  if (server.exitCode === null) await stopped;
}
