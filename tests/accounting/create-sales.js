// Create a sales order (sale.order).
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login } from '../../lib/odoo.js';
import { pickCustomer, pickProduct } from '../../lib/data.js';
import { callKw } from '../../lib/odoo.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('create_sales_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'create-sales', model: 'sale.order', method: 'create', metric: 'create_sales_ms' },
]);

export default function () {
  login();

  let partnerId, productId;
  group('setup', () => {
    partnerId = pickCustomer();
    productId = pickProduct(false);
  });

  const t0 = Date.now();
  const id = callKw('sale.order', 'create', [
    { partner_id: partnerId, order_line: [[0, 0, { product_id: productId, product_uom_qty: 1 }]] },
  ]);
  dur.add(Date.now() - t0);

  check(id, { 'create sales: order id returned': (v) => Number.isInteger(v) && v > 0 });
}
