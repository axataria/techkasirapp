import * as domain from './shared/domain.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./qa/legacy-frontend/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/boot\(\)\.catch\([\s\S]*$/, '');
const context = vm.createContext({
  ...domain,
  Intl, Date, setInterval() {},
  document: { querySelector() { return {}; }, addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: { getItem() { return null; } },
});
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
for (const [hour, greeting] of [[0,'malam'],[3,'malam'],[4,'pagi'],[10,'pagi'],[11,'siang'],[14,'siang'],[15,'sore'],[17,'sore'],[18,'malam'],[23,'malam']]) {
  assert.equal(run(`dashboardGreeting(new Date('2026-11-07T${String(hour).padStart(2,'0')}:00:00+07:00'))`), `Selamat ${greeting}`);
}
run(`state.me={name:'<script>Nama</script>',store:'Toko & teman',role:'owner'};`);
let html = run('dashboard()');
assert.ok(html.includes('&lt;script&gt;Nama&lt;/script&gt;'));
assert.ok(html.includes('Belum ada pembayaran'));
assert.ok(html.includes('Antrean kosong'));
assert.doesNotMatch(html, /NaN|Infinity|undefined/);
run(`state.data={
  dashboard:{totalRevenue:1000000,unitRevenue:750000,serviceRevenue:250000,netProfit:-100000,cash:900000,available:1},
  dashboardReport:{year:2026,months:Array.from({length:12},(_,i)=>({month:'2026-'+String(i+1).padStart(2,'0'),totalRevenue:i===10?1000000:0,netProfit:i===10?-100000:0}))},
  dashboardServices:[{model:'Laptop <b>X</b>',code:'S-01',customer_name:'Dina',received_on:'2026-11-01',status:'Menunggu sparepart'}],
  dashboardUnits:[{status:'Siap dijual'}],
  dashboardPayments:[{details:{source:'J-01',person:'Dina'},paid_on:'2026-11-07',method:'Cash',amount:50000,direction:'OUT'}]
};`);
html = run('dashboard()');
assert.equal((html.match(/class="revenue-column/g)||[]).length, 12);
assert.ok(html.includes('Laptop &lt;b&gt;X&lt;/b&gt;'));
assert.ok(html.includes('− Rp 50.000'));
assert.ok(html.includes('height:100%'));
assert.doesNotMatch(html, /NaN|Infinity|undefined/);
console.log('Dashboard checks passed: WIB greeting boundaries, empty states, escaping, monthly bars, and outgoing payments.');
