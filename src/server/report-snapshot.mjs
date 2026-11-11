import { sumMoney } from '../../shared/domain.mjs';

// Historical inventory follows the sale and return dates, not today's stock
// status. Build these indexes once for all twelve months of a report.
export function createReportSnapshot({ units, sales, unitReturns, customerReturns }) {
  const soldByUnit = new Map();
  for (const sale of sales) {
    const rows = soldByUnit.get(sale.unit_id) || [];
    rows.push(sale);
    soldByUnit.set(sale.unit_id, rows);
  }
  const returnedSales = new Map();
  for (const row of customerReturns) {
    if (row.received_on && (!returnedSales.has(row.sale_id) || row.received_on < returnedSales.get(row.sale_id))) returnedSales.set(row.sale_id, row.received_on);
  }
  const returnedUnits = new Map(unitReturns.map(row => [row.unit_id, row.returned_on]));
  return {
    adjustments(from, end) {
      let revenue = 0, cost = 0;
      for (const row of customerReturns) if (row.received_on && row.received_on >= from && row.received_on <= end) {
        revenue = sumMoney(revenue, row.credit);
        cost = sumMoney(cost, row.cost_credit);
      }
      return { revenue, cost };
    },
    inventoryAt(end) {
      let total = 0;
      for (const unit of units) {
        if (unit.intake_date > end || (returnedUnits.has(unit.id) && returnedUnits.get(unit.id) <= end)) continue;
        const sold = (soldByUnit.get(unit.id) || []).some(sale => sale.sold_on <= end && (!returnedSales.has(sale.id) || returnedSales.get(sale.id) > end));
        if (!sold) total = sumMoney(total, unit.purchase_amount, unit.repair_amount, unit.extra_amount);
      }
      return total;
    },
  };
}
