import assert from 'node:assert/strict';
import { compareValues, tablePage } from './public/data-table.js';

const rows = Array.from({ length: 23 }, (_, index) => ({
  index, values: [`Unit ${index + 1}`, `Rp ${new Intl.NumberFormat('id').format((index + 1) * 100000)}`],
  search: `unit ${index + 1} ${index % 2 ? 'laptop' : 'hp'}`,
}));
const fresh = () => ({ query: '', size: 5, page: 0, sort: null, direction: 1 });
let state = fresh();
let page = tablePage(rows, state);
assert.equal(page.total, 23);
assert.equal(page.pageCount, 5);
assert.equal(page.rows.length, 5);
state.page = 4;
assert.deepEqual(tablePage(rows, state).rows.map(row => row.index), [20, 21, 22]);
state.page = 100;
tablePage(rows, state);
assert.equal(state.page, 4);
state.size = 20;
assert.equal(tablePage(rows, state).rows.length, 3);
assert.equal(state.page, 1);
state = { ...fresh(), query: ' LAPTOP   unit ' };
assert.equal(tablePage(rows, state).total, 11);
state.query = 'unmatched';
page = tablePage(rows, state);
assert.equal(page.total, 0);
assert.equal(page.rows.length, 0);
assert.equal(page.pageCount, 1);
assert.equal(state.page, 0);
state = { ...fresh(), sort: 1, direction: -1 };
assert.deepEqual(tablePage(rows, state).rows.map(row => row.index), [22, 21, 20, 19, 18]);
state = { ...fresh(), sort: 0, direction: 1, size: 20 };
assert.deepEqual(tablePage(rows, state).rows.slice(8, 11).map(row => row.values[0]), ['Unit 9', 'Unit 10', 'Unit 11']);
assert.ok(compareValues('Rp 900.000', 'Rp 1.000.000') < 0);
assert.ok(compareValues('− Rp 50.000', 'Rp 0') < 0);
assert.ok(compareValues('2026-11-01', '2026-11-07') < 0);
assert.ok(compareValues('2', '10') < 0);
const equal = rows.slice(0, 3).map(row => ({ ...row, values: ['same'] }));
assert.deepEqual(tablePage(equal, { ...fresh(), sort: 0 }).rows.map(row => row.index), [0, 1, 2]);
assert.deepEqual(rows.map(row => row.index), Array.from({ length: 23 }, (_, i) => i));
assert.equal(tablePage([], fresh()).total, 0);
console.log('Table checks passed: filtering, natural/currency sorting, stable order, pagination, empty results, and page clamping.');
