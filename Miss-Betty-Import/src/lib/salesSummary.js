// Totals for a set of order rows (one row per line item, amounts per unit).
// Cancelled orders earn nothing, so they're left out of the money totals.
export function summariseSales(orderRows) {
  const totals = { orders: orderRows.length, customers: 0, revenue: 0, cost: 0, profit: 0, misc: 0 };
  const customers = new Set();
  for (const o of orderRows) {
    if (o.customer_id != null) customers.add(o.customer_id);
    if (o.status === 'Cancelled') continue;
    const qty = Number(o.quantity ?? 1);
    totals.revenue += Number(o.unit_price  ?? 0) * qty;
    totals.cost    += Number(o.cost_price  ?? 0) * qty;
    totals.profit  += Number(o.profit      ?? 0) * qty;
    totals.misc    += Number(o.misc_amount ?? 0) * qty;
  }
  totals.customers = customers.size;
  // Avoid float noise like 5457.420000000001 in the cards
  for (const k of ['revenue', 'cost', 'profit', 'misc']) totals[k] = Math.round(totals[k] * 100) / 100;
  return totals;
}
