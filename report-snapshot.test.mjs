import assert from 'node:assert/strict';
import { createReportSnapshot } from './src/server/report-snapshot.mjs';

const snapshot = createReportSnapshot({
  units: [
    { id: 'laptop', intake_date: '2026-01-05', purchase_amount: 100, repair_amount: 20, extra_amount: 5 },
    { id: 'phone', intake_date: '2026-02-01', purchase_amount: 200, repair_amount: 0, extra_amount: 0 },
    { id: 'future', intake_date: '2027-01-01', purchase_amount: '9007199254740993', repair_amount: 0, extra_amount: 0 },
  ],
  sales: [
    { id: 'first', unit_id: 'laptop', sold_on: '2026-01-10' },
    { id: 'resale', unit_id: 'laptop', sold_on: '2026-03-01' },
  ],
  unitReturns: [{ unit_id: 'phone', returned_on: '2026-03-15' }],
  customerReturns: [
    { sale_id: 'first', received_on: '2026-02-10', credit: 170, cost_credit: 125 },
    { sale_id: 'resale', received_on: '2026-04-05', credit: 150, cost_credit: 125 },
    { sale_id: 'pending', received_on: null, credit: 900, cost_credit: 900 },
  ],
});
for (const [date, expected] of [
  ['2026-01-04', 0], ['2026-01-05', 125], ['2026-01-31', 0],
  ['2026-02-09', 200], ['2026-02-10', 325], ['2026-03-01', 200],
  ['2026-03-15', 0], ['2026-04-05', 125], ['2027-01-01', '9007199254741118'],
]) assert.equal(snapshot.inventoryAt(date), expected, date);
assert.deepEqual(snapshot.adjustments('2026-02-01', '2026-02-28'), { revenue: 170, cost: 125 });
assert.deepEqual(snapshot.adjustments('2026-04-01', '2026-04-30'), { revenue: 150, cost: 125 });
assert.deepEqual(snapshot.adjustments('2026-01-01', '2026-01-31'), { revenue: 0, cost: 0 });
console.log('Report snapshots passed: historical returns, resale, supplier returns, future intake and exact large currency.');
