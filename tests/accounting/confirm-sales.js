// Confirm a sales order (sale.order.action_confirm).
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login, callKw } from '../../lib/odoo.js';
import { createSaleOrder } from '../../lib/data.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('confirm_sales_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'confirm-sales', model: 'sale.order', method: 'action_confirm', metric: 'confirm_sales_ms' },
]);

export default function () {
  login();

  let orderId;
  group('setup', () => {
    orderId = createSaleOrder(false, 1);
  });
  check(orderId, { 'confirm sales: draft order created': (v) => Number.isInteger(v) && v > 0 });

  const t0 = Date.now();
  callKw('sale.order', 'action_confirm', [[orderId]]);
  dur.add(Date.now() - t0);

  const state = callKw('sale.order', 'read', [[orderId], ['state']])[0].state;
  check(state, { 'confirm sales: state is sale': (s) => s === 'sale' });
}
