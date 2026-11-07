import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sumMoney, subtractMoney, multiplyMoney, formatMoney, avatarInitial, fieldLimits, validateTextFields } from './public/domain.js';
import { compareValues } from './public/data-table.js';

assert.equal(sumMoney(Number.MAX_SAFE_INTEGER, 1000000), '9007199255740991');
assert.equal(subtractMoney('9007199255740991', 1), '9007199255740990');
assert.equal(multiplyMoney(Number.MAX_SAFE_INTEGER, 2), '18014398509481982');
assert.equal(formatMoney('9007199255740991'), 'Rp 9.007.199.255.740.991');
assert.equal(compareValues('Rp 9.007.199.255.740.991', 'Rp 9.007.199.255.740.992'), -1);
assert.equal(avatarInitial('👩🏽‍💻 Putri'), '👩🏽‍💻');
assert.equal(avatarInitial('J'), 'J');
assert.equal(avatarInitial(''), 'T');
assert.throws(() => validateTextFields({ name: 'N'.repeat(fieldLimits.name + 1) }), /maksimal/);
validateTextFields({ notes: 'N'.repeat(4001) }, { notes: 'N'.repeat(4001) });

const directory = mkdtempSync(join(tmpdir(), 'techkasir-domain-'));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: import.meta.dirname, windowsHide: true,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', TECHKASIR_DATA_DIR: directory },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let cookie = '';
let stderr = '';
server.stderr.on('data', chunk => { stderr += chunk; });
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server startup failed ' + stderr)), 10000);
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.on('error', reject);
  });
  async function request(path, method = 'GET', body, status = 200) {
    const response = await fetch(base + '/api' + path, {
      method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const value = await response.json();
    assert.equal(response.status, status, path + ' ' + JSON.stringify(value));
    return value;
  }
  await request('/setup', 'POST', { storeName:'Domain QA', name:'Owner', username:'owner', password:'domain-test-2026', openingDate:'1970-01-01', openingAmount:0 }, 201);
  await request('/login', 'POST', { username:'owner', password:'domain-test-2026' });
  const unit = { code:'LIMIT-1', category:'Laptop', model:'Workstation', intakeDate:'1970-01-01', purchaseAmount:Number.MAX_SAFE_INTEGER, repairAmount:1, extraAmount:0, targetAmount:0, status:'Siap dijual' };
  await request('/units', 'POST', unit, 201);
  await request('/units', 'POST', { ...unit, code:'LIMIT-2', purchaseAmount:999999, repairAmount:0 }, 201);
  assert.equal((await request('/dashboard')).inventoryValue, '9007199255740991');
  assert.equal((await request('/units')).find(row => row.code === 'LIMIT-1').total_cost, '9007199254740992');
  const report = await request('/reports?year=1970');
  assert(report.years.includes(1970));
  assert.equal(report.months[0].inventory, '9007199255740991');
  assert.equal(report.months[11].month, '1970-12');
  assert.equal((await request('/reports?year=0001')).months[0].month, '0001-01');
  await request('/reports?year=10000', 'GET', undefined, 400);
  await request('/customers', 'POST', { name:'N'.repeat(161) }, 400);
  await request('/units', 'POST', { ...unit, code:'BAD-DATE', intakeDate:'2026-02-30' }, 400);
  const stock = await request('/units');
  for (const row of stock) {
    await request('/sales', 'POST', {
      code:'SALE-' + row.code, unitId:row.id, buyerName:'Pembeli lunas',
      soldOn:'1970-01-01', price:Number.MAX_SAFE_INTEGER, discount:0, saleCost:0,
      initialPayment:Number.MAX_SAFE_INTEGER, method:'Cash',
    }, 201);
  }
  assert.equal((await request('/sales')).find(row => row.code === 'SALE-LIMIT-1').unit_cost_snapshot, '9007199254740992');
  assert.equal((await request('/dashboard')).cash, '18014398509481982');
  assert.equal((await request('/reports?year=1970')).months[0].totalRevenue, '18014398509481982');
  const customer = await request('/customers', 'POST', { name:'Legacy customer', phone:'0812345678' }, 201);
  const service = await request('/services', 'POST', {
    code:'LEGACY-SERVICE', customerId:customer.id, receivedOn:'2000-01-01',
    category:'Laptop', model:'Laptop', complaint:'Keyboard',
  }, 201);
  const legacyNotes = 'Catatan lama '.repeat(400);
  const db = new DatabaseSync(join(directory, 'store.db'));
  db.prepare('UPDATE service_jobs SET notes=? WHERE id=?').run(legacyNotes, service.id);
  db.close();
  await request('/services/' + service.id, 'PATCH', {
    estimateAmount:0, partUnitCost:0, partQty:0, partCharge:0, serviceCharge:0,
    technicianCost:0, partCode:'', notes:legacyNotes,
  });
  const largeService = await request('/services', 'POST', {
    code:'LARGE-SERVICE', customerId:customer.id, receivedOn:'1970-01-01',
    category:'Laptop', model:'Laptop', complaint:'Pemeriksaan',
    partCharge:Number.MAX_SAFE_INTEGER, serviceCharge:Number.MAX_SAFE_INTEGER,
    partUnitCost:Number.MAX_SAFE_INTEGER, partQty:Number.MAX_SAFE_INTEGER,
  }, 201);
  await request('/services/' + largeService.id + '/status', 'PATCH', {status:'Selesai', completedOn:'1970-01-01'});
  for (let payment = 0; payment < 2; payment++) {
    await request('/payments', 'POST', {
      sourceType:'service', sourceId:largeService.id, amount:Number.MAX_SAFE_INTEGER,
      paidOn:'1970-01-01', method:'Transfer',
    }, 201);
  }
  assert.equal((await request('/services')).find(row => row.id === largeService.id).remaining, 0);
  assert.equal((await request('/customers')).find(row => row.id === customer.id).outstanding, 0);
  assert.equal((await request('/reports?year=1970')).months[0].serviceCost,
    (BigInt(Number.MAX_SAFE_INTEGER) ** 2n).toString());
  console.log('Domain checks passed: exact large totals, stored derived costs, monetary sorting, graphemes, historical years, limits, and legacy edits.');
} finally {
  server.kill();
  if (server.exitCode === null) await once(server, 'exit');
  if (resolve(directory).startsWith(resolve(tmpdir()) + sep)) {
    rmSync(directory, { recursive: true, force: true });
  }
}
