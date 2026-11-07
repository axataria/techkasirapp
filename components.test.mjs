import * as domain from './public/domain.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

const appSource = readFileSync(new URL('./public/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/boot\(\)\.catch\([\s\S]*$/, '');
const appContext = vm.createContext({
  ...domain,
  Intl, Date, setInterval() {},
  document: { querySelector() { return {}; }, addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: { getItem() { return null; } },
});
vm.runInContext(appSource, appContext);
const run = expression => vm.runInContext(expression, appContext);

// Non-submit actions must remain safe inside valid transaction forms.
assert.match(run("btn('Batal', 'close-modal')"), /type="button"/);
const actions = run("formActions('Simpan')");
assert.equal((actions.match(/type="submit"/g) || []).length, 1);
assert.match(run("select('Pelanggan', 'customerId', [])"), /menu Pelanggan/);
assert.match(run("select('Unit', 'unitId', [])"), /menu Stok unit/);
assert.match(run("field('Tanggal', 'date', 'date')"), /format perangkat/);
run("state.data.customers = [{id:'1',name:'Dina',phone:'081234',outstanding:0,advances:0}]; state.search=' dina ';");
assert.match(run('customerList()'), /Dina/);
run("state.search='missing'");
assert.match(run('customerList()'), /Pelanggan tidak ditemukan/);

const submit = { disabled: false, textContent: 'Cari' };
const input = {
  value: 'Samsung',
  setCustomValidity() {},
  reportValidity() { return true; },
  focus() {},
};
const form = {
  reportValidity() { return true; },
  querySelector() { return submit; },
};
const results = {
  innerHTML: '',
  setAttribute() {},
  removeAttribute() {},
};
const status = { textContent: '' };
const pagination = { innerHTML: '' };
const elements = {
  form, input,
  '.search-status': status,
  '.search-results': results,
  '.search-pagination': pagination,
  '[data-close]': {},
};
const dialog = {
  isConnected: true,
  setAttribute() {},
  addEventListener() {},
  querySelector(selector) { return elements[selector]; },
  showModal() {},
};
const searchContext = vm.createContext({
  document: {
    querySelector() { return null; },
    createElement() { return dialog; },
    body: { append() {} },
  },
});
vm.runInContext(readFileSync(new URL('./public/search.js', import.meta.url), 'utf8')
  .replace('export function openSearch', 'function openSearch'), searchContext);

let resolveRequest;
searchContext.openSearch({
  post: () => new Promise(resolve => { resolveRequest = resolve; }),
  navigate() {},
});
form.onsubmit({ preventDefault() {} });
assert.equal(submit.disabled, true);
assert.equal(submit.textContent, 'Mencari…');
input.value = 'ThinkPad';
input.oninput();
resolveRequest({
  total: 1, offset: 0, message: '', hasMore: false,
  results: [{ label: 'Unit', title: 'Samsung lama', fields: {} }],
});
await setImmediate();
assert.equal(results.innerHTML, '');
assert.equal(submit.disabled, false);
assert.match(status.textContent, /Tekan Cari/);

form.onsubmit({ preventDefault() {} });
resolveRequest({
  total: 1, offset: 0, message: '', hasMore: false,
  results: [{ label: 'Unit', title: 'ThinkPad terbaru', fields: {} }],
});
await setImmediate();
assert.match(results.innerHTML, /ThinkPad terbaru/);
assert.equal(submit.textContent, 'Cari');
console.log('Component checks passed: safe Cancel, dropdown guidance, customer filtering, and stale search responses.');
