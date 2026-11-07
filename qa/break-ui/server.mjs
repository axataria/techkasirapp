import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

// Local audit server. It never opens the application's normal data directory.
const root = resolve(import.meta.dirname, '../..');
const output = resolve(import.meta.dirname);
const data = join(output, 'isolated-data');
mkdirSync(data, { recursive: true });
const backend = spawn(process.execPath, ['server.mjs'], {
  cwd: root, windowsHide: true,
  env: { ...process.env, TECHKASIR_DATA_DIR: data, PORT: '3102', HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
backend.stderr.on('data', chunk => process.stderr.write(chunk));
const base = 'http://127.0.0.1:3102';
let cookie = '';
async function api(path, method = 'GET', body) {
  const response = await fetch(base + '/api' + path, {
    method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const value = await response.json();
  if (!response.ok) throw Error(path + ': ' + JSON.stringify(value));
  return value;
}
for (let attempt = 0; attempt < 80; attempt++) {
  try { await fetch(base + '/api/bootstrap'); break; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if ((await api('/bootstrap')).needsSetup) {
  await api('/setup', 'POST', {
    storeName: 'TechKasir QA', name: 'Pemilik QA', username: 'audit',
    password: 'Audit-local-only-2026', openingDate: '2026-11-07', openingAmount: 0,
  });
}
await api('/login', 'POST', { username: 'audit', password: 'Audit-local-only-2026' });
if (!(await api('/customers')).length) {
  const customer = await api('/customers', 'POST', { name: 'Siti Rahma', phone: '081234567890', notes: '' });
  const unit = await api('/units', 'POST', {
    code: 'QA-UNIT-01', category: 'Laptop', model: 'ThinkPad T14', intakeDate: '2026-11-07',
    purchaseAmount: 2000000, repairAmount: 0, extraAmount: 0, targetAmount: 3000000, status: 'Siap dijual',
  });
  await api('/sales', 'POST', {
    code: 'QA-SALE-01', unitId: unit.id, customerId: customer.id, soldOn: '2026-11-07',
    price: 3000000, discount: 0, saleCost: 0, initialPayment: 500000, method: 'Transfer',
  });
  await api('/units', 'POST', {
    code: 'QA-UNIT-02', category: 'HP', model: 'Samsung A54', intakeDate: '2026-11-07',
    purchaseAmount: 1000000, repairAmount: 0, extraAmount: 0, targetAmount: 1500000, status: 'Siap dijual',
  });
  await api('/services', 'POST', {
    code: 'QA-SERVICE-01', customerId: customer.id, receivedOn: '2026-11-07', category: 'Laptop',
    model: 'Dell Latitude 5420', complaint: 'Keyboard tidak berfungsi', estimateAmount: 350000,
    partUnitCost: 100000, partQty: 1, partCharge: 150000, serviceCharge: 200000, technicianCost: 50000,
  });
  for (const endpoint of ['expenses', 'incomes', 'losses']) {
    await api('/' + endpoint, 'POST', {
      code: 'QA-' + endpoint, happenedOn: '2026-11-07', category: 'Operasional',
      description: 'Transaksi fiktif audit', amount: 75000,
    });
  }
  await api('/users', 'POST', {
    name: 'Staf QA', username: 'audit-cashier', password: 'Audit-local-only-2026', role: 'cashier',
  });
}
const paths = ['me','dashboard','reports?year=2026','opening','customers','units','sales','services','payments','expenses','incomes','losses','users','audit'];
const baseline = {};
for (const path of paths) baseline[path.split('?')[0]] = await api('/' + path);

const longName = 'Raden Ajeng Sekar Ayu Puspitaningrum Kusumaningtyas Pramudawardhani';
const longCode = 'INV/JKT/TECHKASIR/REKONDISI/CORPORATE/2026/11/000001';
const longModel = 'Lenovo ThinkPad X1 Carbon Gen 12 Intel Core Ultra 7 RAM 64 GB SSD 2 TB Garansi Distributor Indonesia';
const names = [longName, 'J', "José Wijaya 日本 & Siti <b>QA</b>", '👩🏽‍💻 Putri', 'نور الهدى عبد الرحمن'];
const descriptions = 'Pemeriksaan motherboard, penggantian konektor pengisian, pemulihan data pelanggan, dan pengujian perangkat setelah terkena cairan. '.repeat(15);
const statuses = ['Diterima','Dalam pengerjaan','Menunggu sparepart','Selesai','Batal'];
function fixture(mode, key) {
  const original = structuredClone(baseline[key]);
  if (mode === 'demo' || !original) return original;
  if (key === 'me') return { ...original, name: names[3], store: 'PT Teknologi Nusantara Cabang Jakarta Selatan — Penjualan Laptop & Ponsel Rekondisi' };
  if (key === 'dashboard') {
    if (mode === 'empty') return Object.fromEntries(Object.keys(original).map(key => [key, 0]));
    return { ...original, unitRevenue: 9876543210987, totalRevenue: 9876543210987,
      grossProfit: -987654321098, netProfit: -987654321098, cash: -987654321098,
      receivables: 9876543210987, inventoryValue: 9876543210987, available: 1284, openServices: 1284 };
  }
  if (key === 'reports') {
    if (mode === 'empty') {
      for (const month of original.months) for (const field of Object.keys(month)) if (field !== 'month') month[field] = 0;
    } else {
      for (const month of original.months) {
        month.totalRevenue = 9876543210987; month.netProfit = -987654321098;
        month.closingCash = -987654321098; month.inventory = 9876543210987;
      }
    }
    return original;
  }
  if (!Array.isArray(original)) return original;
  if (mode === 'empty') return [];
  const count = mode === 'one' ? 1 : mode === 'thousand' ? 1000 : 5;
  return Array.from({ length: count }, (_, index) => {
    const row = structuredClone(original[index % original.length] || {});
    if (!original.length) return row;
    row.id = index === 0 ? row.id : 'qa-fixture-' + key + '-' + index;
    if ('name' in row) row.name = names[index % names.length];
    if ('phone' in row) row.phone = index % 2 ? null : '+62 812 3456 7890';
    if ('notes' in row) row.notes = index % 2 ? '' : descriptions;
    if ('code' in row) row.code = index % 2 ? 'QA-' + index : longCode + index;
    if ('model' in row) row.model = index % 2 ? 'iPhone 16' : longModel;
    if ('complaint' in row) row.complaint = descriptions;
    if ('customer_name' in row) row.customer_name = names[index % names.length];
    if ('buyer_name' in row) row.buyer_name = names[index % names.length];
    if ('description' in row) row.description = descriptions;
    if ('supplier' in row) row.supplier = longName;
    if ('part_code' in row) row.part_code = 'USB-C-PD-THINKPAD-X1CARBON-GEN12-INDONESIA-2026';
    if (key === 'services') row.status = statuses[index % statuses.length];
    if (key === 'units') row.status = ['Siap dijual','Menunggu sparepart','Minus / rusak','Dalam perbaikan','Retur'][index % 5];
    if ('details' in row) row.details = { ...row.details, person: names[index % names.length], source: longCode, reference: descriptions };
    for (const field of ['amount','total_cost','target_amount','outstanding','advances','remaining','price_amount','estimate_amount']) {
      if (field in row) row[field] = index % 3 === 0 ? 9876543210987 : index % 3 === 1 ? 0 : 1;
    }
    return row;
  });
}
writeFileSync(join(output, 'fixtures.json'), JSON.stringify({ longName, longCode, longModel, names, descriptions, baseline }, null, 2));
const mapped = {};
for (const [endpoint, value] of Object.entries(baseline)) {
  const sample = Array.isArray(value) ? value[0] : value;
  mapped[endpoint] = Object.fromEntries(Object.entries(sample || {}).map(([key, val]) => [key, {
    type: typeof val, limit: typeof val === 'string' ? (/date|_on|_at/.test(key) ? 'ISO date/timestamp' : 'unbounded text unless enum') : 'safe integer for input money; aggregates require separate checks',
  }]));
}
writeFileSync(join(output, 'surface-map.json'), JSON.stringify(mapped, null, 2));
let fault = { path: '', delay: 0, fail: false };
const toolbar = `
const modes=['demo','worst','empty','one','thousand'];
const control=document.createElement('div');
control.id='qa-controls';
Object.assign(control.style,{position:'fixed',bottom:'8px',left:'50%',transform:'translateX(-50%)',zIndex:'999',display:'flex',gap:'4px',padding:'6px',borderRadius:'8px',background:'#dedede',color:'#222',font:'12px sans-serif',maxWidth:'95vw',overflow:'auto'});
for(const mode of modes){const link=document.createElement('a');link.href='/?data='+mode;link.textContent=({demo:'Demo data',worst:'Worst case',empty:'Empty',one:'One',thousand:'1,000 rows'})[mode];Object.assign(link.style,{padding:'6px',whiteSpace:'nowrap',color:'#222',background:new URL(location.href).searchParams.get('data')===mode?'#fff':'transparent'});control.append(link);}
document.addEventListener('DOMContentLoaded',()=>document.body.append(control));
`;
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' };
const proxy = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:3101');
    if (url.pathname === '/__qa/fault') {
      let text = ''; for await (const chunk of req) text += chunk;
      fault = JSON.parse(text);
      res.end('ok'); return;
    }
    if (url.pathname === '/__qa/controls.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(toolbar); return; }
    const mode = url.searchParams.get('data') || req.headers.cookie?.match(/qa_mode=(\w+)/)?.[1] || 'demo';
    if (url.pathname === '/') res.setHeader('Set-Cookie', 'qa_mode=' + mode + '; Path=/; SameSite=Lax');
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === fault.path) {
        if (fault.delay) await new Promise(resolve => setTimeout(resolve, fault.delay));
        if (fault.fail) { res.writeHead(503, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Koneksi uji terputus. Silakan coba lagi.'})); return; }
      }
      const key = url.pathname.slice(5);
      if (req.method === 'GET' && key in baseline) {
        let payload = fixture(mode, key);
        if (key === 'reports' && url.searchParams.has('year')) {
          const year = Number(url.searchParams.get('year'));
          if (payload.year !== year) {
            const live = await api('/reports?year=' + year);
            if (mode === 'demo') payload = live;
            else {
              payload.year = year;
              payload.years = live.years;
              payload.months.forEach((month, index) => {
                month.month = String(year).padStart(4, '0') + '-' + String(index + 1).padStart(2, '0');
              });
            }
          }
        }
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify(payload)); return;
      }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await fetch(base + url.pathname + url.search, {
        method: req.method, headers: {'Content-Type':'application/json',Cookie:cookie},
        body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      res.writeHead(response.status, {'Content-Type':response.headers.get('Content-Type') || 'application/json'});
      res.end(await response.text()); return;
    }
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!/^[\w.-]+$/.test(path)) { res.writeHead(404); res.end(); return; }
    let content = readFileSync(join(root, 'public', path));
    if (path === 'index.html') content = content.toString().replace('</head>', '<script src="/__qa/controls.js"></script></head>');
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
proxy.listen(3101, '127.0.0.1', () => console.log('Isolated QA ready at http://127.0.0.1:3101/?data=worst'));
process.on('SIGINT', () => { proxy.close(); backend.kill(); process.exit(); });
