import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A separate store and ephemeral port; never opens the real store database.
const data = mkdtempSync(join(tmpdir(), 'techkasir-next-test-'));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: import.meta.dirname, env: { ...process.env, PORT: '0', TECHKASIR_DATA_DIR: data },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let output = '', errors = '';
child.stdout.on('data', chunk => output += chunk);
child.stderr.on('data', chunk => errors += chunk);
let cookie = '';
try {
  for (let n = 0; n < 150 && !/running at http/.test(output); n++) {
    if (child.exitCode !== null) throw Error(errors || output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const base = output.match(/running at (http:\/\/[^\s]+)/)?.[1];
  assert.ok(base, `Next.js did not start: ${errors}`);
  const request = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const root = await request('/');
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.match(html, /\/_next\/static\//);
  assert.match(html, /TechKasir V3/);
  assert.doesNotMatch(html, /src="\/app.js"|href="\/style.css"/);
  for (const path of ['/dashboard', '/sales', '/orders', '/customers', '/warranties', '/customer-returns', '/units', '/receiving', '/qc', '/supplier-returns', '/reports', '/settings', '/staff', '/finance', '/payments', '/audit']) assert.equal((await request(path)).status, 200, path);
  for (const path of ['/style.css', '/app.js', '/index.html', '/not-a-page']) assert.equal((await request(path)).status, 404, path);
  const assets = [...html.matchAll(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
  for (const asset of new Set(assets)) assert.equal((await request(asset)).status, 200, asset);
  assert.equal((await (await request('/api/bootstrap')).json()).needsSetup, true);
  assert.equal((await request('/api/setup', { storeName: 'Next test store', name: 'Next owner', username: 'next-owner', password: 'next-integration-only-2026', openingDate: '2026-11-01', openingAmount: 0 })).status, 201);
  assert.equal((await request('/api/login', { username: 'next-owner', password: 'next-integration-only-2026' })).status, 200);
  assert.ok(cookie.startsWith('tk_session='));
  assert.equal((await (await request('/api/me')).json()).role, 'owner');
  const customerResponse = await request('/api/customers', { name: 'Next customer', phone: '0800000000' }, { Origin: base });
  assert.equal(customerResponse.status, 201);
  const customer = await customerResponse.json();
  assert.equal((await request('/api/customers', { name: 'Rejected cross origin' }, { Origin: 'https://example.invalid' })).status, 403);
  assert.equal((await request('/api/v2/summary')).status, 200);
  const write = async (path, body, expected = 201, method = 'POST') => {
    const response = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base }, body: JSON.stringify(body) });
    const value = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
    return value;
  };
  await write('/v2/policy', { days: 30, terms: 'Garansi fungsi utama.' });
  const supplier = await write('/v2/suppliers', { name: 'Supplier V3', phone: '080001' });
  const product = await write('/v2/products', { category: 'Laptop', model: 'Laptop V3', specs: 'RAM 16 GB' });
  await write(`/v2/products/${product.id}`, { active: 0 });
  await write(`/v2/products/${product.id}`, { active: 1 });
  const receipt = await write('/v2/receiving', { supplierId: supplier.id, receivedOn: '2026-11-01', items: [{ productId: product.id, code: 'V3-UNIT-1', category: 'Laptop', model: 'Laptop V3', specs: 'RAM 16 GB', purchaseAmount: 2000000, repairAmount: 0, extraAmount: 0, targetAmount: 3000000 }] });
  await write(`/v2/receiving/${receipt.id}/finalize`, {});
  const unit = (await (await request('/api/units')).json()).find(row => row.code === 'V3-UNIT-1');
  assert.equal(unit.status, 'Menunggu QC');
  const checklist = Object.fromEntries(['Identitas','Fisik','Layar','Baterai','Input','Port','Konektivitas','Audio/kamera','Aksesori','Fungsi utama'].map(key => [key, 'Lulus']));
  await write('/v2/qc', { unitId: unit.id, checkedOn: '2026-11-02', result: 'Lulus', checklist });
  const salePayload = { requestKey: 'v3-integration-sale', code: 'V3-SALE-1', unitId: unit.id, customerId: customer.id, soldOn: '2026-11-03', price: 3000000, discount: 100000, saleCost: 0, initialPayment: 1000000, method: 'Cash', channel: 'Toko' };
  const sale = await write('/sales', salePayload);
  assert.equal((await write('/sales', salePayload)).id, sale.id);
  await write('/payments', { requestKey: 'v3-integration-payment', sourceType: 'sale', sourceId: sale.id, paidOn: '2026-11-04', amount: 1900000, method: 'Transfer', reference: 'Pelunasan V3' });
  const savedSale = (await (await request('/api/sales')).json()).find(row => row.id === sale.id);
  assert.equal(savedSale.remaining, 0);
  const invoice = await request(`/document?type=invoice&id=${savedSale.invoice_id}`);
  assert.equal(invoice.status, 200);
  assert.match(await invoice.text(), /V3-SALE-1/);
  const search = await (await request('/api/search', { query: 'V3-SALE-1', offset: 0 })).json();
  assert.ok(search.results.some(row => row.id === sale.id));
  const service = await write('/services', { code: 'V3-SERVICE-1', customerId: customer.id, receivedOn: '2026-11-03', category: 'Laptop', model: 'Laptop servis', complaint: 'Pembersihan perangkat', estimateAmount: 200000, partCode: '', partUnitCost: 0, partQty: 0, partCharge: 0, serviceCharge: 200000, technicianCost: 50000 });
  await write(`/services/${service.id}/status`, { status: 'Selesai', completedOn: '2026-11-04' }, 200, 'PATCH');
  await write('/v2/warranties', { saleId: sale.id, openedOn: '2026-11-04', complaint: 'Periksa port' });
  const report = await (await request('/api/v2/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(report.unitRevenue, 2900000);
  assert.equal(report.serviceRevenue, 200000);
  assert.equal(report.currentReceivables, 200000);
  await write('/users', { username: 'v3-cashier', name: 'Kasir V3', role: 'cashier', password: 'v3-cashier-test-2026' });
  const ownerCookie = cookie;
  assert.equal((await request('/api/login', { username: 'v3-cashier', password: 'v3-cashier-test-2026' })).status, 200);
  assert.equal((await request('/api/v2/summary')).status, 403);
  const cashierUnits = await (await request('/api/units')).json();
  assert.ok(cashierUnits.every(row => !('purchase_amount' in row) && !('total_cost' in row)));
  await request('/api/logout', {});
  cookie = ownerCookie;
  assert.equal((await request('/api/logout', {})).status, 200);
  assert.equal((await request('/api/me')).status, 401);
  console.log('V3 Next.js integration passed: routes/assets, setup/login/logout, origin checks, supplier/product/receiving/QC, idempotent DP sale, settlement, invoice, search, service completion, warranty, reports, and cashier permissions.');
} finally {
  child.kill();
}
