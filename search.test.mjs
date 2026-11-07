import assert from 'node:assert/strict';
import { searchRecords } from './search.mjs';

const records = Array.from({length:23},(_,i)=>({id:String(i),code:`U-${i}`,model:'Samsung',intake_date:'2026-10-05'}));
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Search must not call external services'); };
try {
  const read = async scope => scope === 'units' ? records : [];
  const found = await searchRecords({query:'stok SAMSUNG',role:'cashier',offset:20,read});
  assert.equal(found.total,23);
  assert.equal(found.results.length,3);
  assert.equal(found.hasMore,false);
  assert.equal(found.results[0].id,'20');
  const first = await searchRecords({query:'Samsung',role:'owner',read});
  assert.equal(first.results.length,20);
  assert.equal(first.hasMore,true);
  assert.equal((await searchRecords({query:'Samsung U-22',role:'owner',read})).total,1);
  assert.equal((await searchRecords({query:'Samsung nonexistent',role:'owner',read})).total,0);
  assert.equal((await searchRecords({query:'???',role:'owner',read})).total,0);
  for (const role of ['cashier','service']) {
    const forbidden = role === 'cashier' ? 'services' : 'sales';
    await searchRecords({query:'Samsung',role,read:async scope => {
      assert(![forbidden,'expenses','incomes','losses','users','audit'].includes(scope));
      return [];
    }});
  }
  console.log('Search checks passed: database keyword matching, role boundaries, pagination, and no external requests.');
} finally {
  globalThis.fetch = originalFetch;
}
