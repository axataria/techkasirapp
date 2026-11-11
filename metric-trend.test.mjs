import assert from 'node:assert/strict';
import { comparisonPeriods, metricChange } from './src/lib/metric-trend.ts';

assert.deepEqual(comparisonPeriods('2026-11-11'), {
  current: { from: '2026-11-01', to: '2026-11-11' },
  previous: { from: '2026-10-01', to: '2026-10-11' },
});
assert.deepEqual(comparisonPeriods('2026-01-05').previous, { from: '2025-12-01', to: '2025-12-05' });
assert.equal(comparisonPeriods('2026-03-31').previous.to, '2026-02-28');
assert.equal(comparisonPeriods('2024-03-31').previous.to, '2024-02-29');
assert.deepEqual(metricChange('150000', '100000'), { direction: 'up', amount: 50000n });
assert.deepEqual(metricChange('50000', '100000'), { direction: 'down', amount: 50000n });
assert.deepEqual(metricChange(0, 0), { direction: 'flat', amount: 0n });
assert.deepEqual(metricChange('-100000', '-200000'), { direction: 'up', amount: 100000n });
assert.deepEqual(metricChange('-200000', '100000'), { direction: 'down', amount: 300000n });
assert.deepEqual(metricChange('9007199254740993001', '9007199254740993000'), { direction: 'up', amount: 1n });
console.log('Metric trends passed: direction, losses, zero, exact rupiah, year rollover, and month lengths.');
