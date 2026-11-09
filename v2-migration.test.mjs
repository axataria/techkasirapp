import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,readFileSync,readdirSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash,scryptSync } from 'node:crypto';
import assert from 'node:assert/strict';

const temp=mkdtempSync(join(tmpdir(),'techkasir-v1-migration-')),path=join(temp,'store.db'),db=new DatabaseSync(path);
const source=readFileSync(new URL('./src/server/store.mjs',import.meta.url),'utf8'),schema=source.match(/db\.exec\(`([\s\S]*?)`\);/)[1];
db.exec(schema);
const stamp='2026-11-01T00:00:00.000Z',password='legacy-password-123',salt='test-v1-salt',token='legacy-session-token';
db.prepare('INSERT INTO stores VALUES(?,?,?)').run('store','Legacy store',stamp);
db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run('user','store','legacy','Pemilik','owner',salt+':'+scryptSync(password,salt,64).toString('hex'),1,stamp);
db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'user','2099-01-01T00:00:00.000Z',stamp);
db.prepare('INSERT INTO opening_balances VALUES(?,?,?,?,?)').run('opening','store','2026-11-01',1000000,stamp);
db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?)').run('customer','store','Pelanggan lama','08123','Catatan lama',stamp);
db.prepare('INSERT INTO units VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('unit','store','LEGACY-01','Laptop','Unit lama','RAM 16 GB','Supplier lama','2026-11-01',2000000,0,0,3000000,'Siap dijual','',stamp);
db.prepare('INSERT INTO sales VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('sale','store','LEGACY-SALE','unit','customer','Pelanggan lama','2026-11-02',3000000,0,0,2000000,stamp);
db.prepare('INSERT INTO invoices VALUES(?,?,?,?,?,?,?,?)').run('invoice','store','INV-LEGACY','sale','sale',3000000,JSON.stringify({store:'Legacy store',source:'LEGACY-SALE',person:'Pelanggan lama',date:'2026-11-02',amount:3000000}),stamp);
db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('payment','store','sale','sale','IN',1000000,'Cash','2026-11-02','','user',stamp);
db.prepare('INSERT INTO payment_documents VALUES(?,?,?,?,?,?,?,?)').run('document','store','PAY-LEGACY','payment','invoice','Kuitansi pembayaran',JSON.stringify({store:'Legacy store',source:'LEGACY-SALE',person:'Pelanggan lama',amount:1000000,cumulative:1000000,remaining:2000000,kind:'Kuitansi pembayaran'}),stamp);
db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)').run('audit','store','user','sale','sale','create','Histori asli',stamp);db.close();
const port=37000+Math.floor(Math.random()*1000),server=spawn(process.execPath,['scripts/api-test-server.mjs'],{env:{...process.env,PORT:String(port),TECHKASIR_DATA_DIR:temp},stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',x=>stderr+=x);
async function get(route){const res=await fetch(`http://127.0.0.1:${port}`+route,{headers:{Cookie:'tk_session='+token}});assert.equal(res.status,200,route);return res.headers.get('content-type')?.includes('application/json')?res.json():res.text();}
try{
  for(let i=0;i<80;i++){try{await fetch(`http://127.0.0.1:${port}/api/bootstrap`);break;}catch{if(server.exitCode!==null)throw Error(stderr);await new Promise(r=>setTimeout(r,50));}}
  assert.equal((await get('/api/me')).id,'user');const sales=await get('/api/sales');assert.equal(sales.length,1);assert.equal(sales[0].id,'sale');assert.equal(sales[0].remaining,2000000);assert.equal(sales[0].warranty_days,null);
  assert.match(await get('/document?type=invoice&id=invoice'),/INV-LEGACY/);assert.match(await get('/document?type=payment&id=document'),/PAY-LEGACY/);
  const summary=await get('/api/v2/summary?from=2026-11-01&to=2026-11-30');assert.equal(summary.revenue,3000000);assert.equal(summary.netProfit,1000000);assert.equal(summary.currentReceivables,2000000);
  assert.equal((await get('/api/dashboard')).cash,2000000);assert.equal((await get('/api/audit')).some(x=>x.detail==='Histori asli'),true);
  const backup=readdirSync(temp).find(f=>f.startsWith('before-v2-'));assert(backup);const original=new DatabaseSync(join(temp,backup));assert.equal(original.prepare('SELECT COUNT(*) n FROM sales').get().n,1);assert.equal(original.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='v2_schema'").get().n,0);original.close();
  const migrated=new DatabaseSync(path);assert.equal(migrated.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(migrated.prepare('SELECT snapshot FROM invoices WHERE id=?').get('invoice').snapshot.includes('LEGACY-SALE'),true);migrated.close();
  const isolationBackup = readdirSync(temp).find(file => file.startsWith('before-store-isolation-'));
  assert.ok(isolationBackup);
  const beforeIsolation = new DatabaseSync(join(temp, isolationBackup));
  assert.equal(beforeIsolation.prepare('SELECT COUNT(*) AS count FROM stores').get().count, 1);
  beforeIsolation.close();

  async function request(route, cookie, body, status = 200) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const content = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    assert.equal(response.status, status, `${route} ${JSON.stringify(content)}`);
    return { content, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }

  const newOwner = { storeName: 'New store', name: 'New owner', username: 'new-owner', password };
  const { content: registered } = await request('/api/register', '', { ...newOwner, openingAmount: 999999 }, 201);
  assert.match(registered.recoveryCode, /^[0-9A-F]{4}(?:-[0-9A-F]{4}){7}$/);
  await request('/api/register', '', newOwner, 409);
  const { cookie: newSession } = await request('/api/login', '', newOwner);
  const originalSession = `tk_session=${token}`;
  assert.equal((await request('/api/me', newSession)).content.store, newOwner.storeName);
  for (const route of ['/api/units', '/api/customers', '/api/sales', '/api/services', '/api/payments', '/api/v2/products']) {
    assert.deepEqual((await request(route, newSession)).content, [], route);
  }
  assert.equal((await request('/api/dashboard', newSession)).content.cash, 0);
  await request('/document?type=invoice&id=invoice', newSession, null, 404);
  await request('/api/users/user/deactivate', newSession, {}, 404);
  assert.equal((await get('/api/me')).id, 'user');

  const unit = { code: 'SAME-STOCK', category: 'Laptop', model: 'Shared model', intakeDate: '2026-11-01', purchaseAmount: 100, status: 'Siap dijual' };
  const sale = { code: 'SAME-SALE', soldOn: '2026-11-02', requestKey: 'same-sale-key', price: 200, initialPayment: 200, method: 'Cash' };
  for (const cookie of [originalSession, newSession]) {
    const { content: stock } = await request('/api/units', cookie, unit, 201);
    await request('/api/units', cookie, unit, 409);
    const payload = { ...sale, unitId: stock.id };
    const { content: created } = await request('/api/sales', cookie, payload, 201);
    assert.deepEqual((await request('/api/sales', cookie, payload, 201)).content, created);
    const rows = (await request('/api/sales', cookie)).content;
    assert.equal(rows.find(row => row.id === created.id).invoice_number, 'INV-000001');
  }
  assert.deepEqual((await request('/api/sales', newSession)).content.map(row => row.code), ['SAME-SALE']);
  assert.equal((await get('/api/sales')).length, 2);
  await request('/api/recovery/saved/replace', newSession, { currentPassword: 'wrong-password' }, 403);
  const { content: replacement } = await request('/api/recovery/saved/replace', newSession, { currentPassword: password });
  const newPassword = 'different-password-123';
  await request('/api/recovery/saved/reset', '', { recoveryCode: registered.recoveryCode, password: newPassword }, 400);
  const attempts = await Promise.all([1, 2].map(() => fetch(`http://127.0.0.1:${port}/api/recovery/saved/reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: replacement.recoveryCode.toLowerCase().replaceAll('-', ' '), password: newPassword }),
  })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [200, 400]);
  const reset = await attempts.find(response => response.ok).json();
  assert.equal(reset.username, newOwner.username);
  assert.notEqual(reset.recoveryCode, replacement.recoveryCode);
  await request('/api/me', newSession, null, 401);
  await request('/api/login', '', newOwner, 401);
  await request('/api/login', '', { username: newOwner.username, password: newPassword });
  assert.equal((await get('/api/me')).id, 'user');
  console.log('Saved recovery passed: offline issuance, password-protected replacement, concurrent replay rejection, account-scoped session revocation and new login.');
  console.log('Store isolation passed: empty registration, cross-store session and document protection, and independent stock codes and invoice sequences.');
  console.log('Legacy migration passed: existing sessions, accounts, IDs, invoices, payment snapshots, audit and balances preserved; pre-migration SQLite backup verified.');
}finally{if(server.exitCode===null){server.kill();await once(server,'exit');}rmSync(temp,{recursive:true,force:true});}
