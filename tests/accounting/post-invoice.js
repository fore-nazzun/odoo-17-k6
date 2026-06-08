// Post the customer invoice for a sale order (account.move.action_post).
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login, callKw } from '../../lib/odoo.js';
import { createSaleOrder, confirmSaleOrder, invoiceSaleOrder } from '../../lib/data.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('post_invoice_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'post-invoice', model: 'account.move', method: 'action_post', metric: 'post_invoice_ms' },
]);

export default function () {
  login();

  let invoiceIds = [];
  group('setup', () => {
    const orderId = createSaleOrder(false, 1, true);
    confirmSaleOrder(orderId);
    invoiceIds = invoiceSaleOrder(orderId);
  });
  if (!check(invoiceIds, { 'post invoice: draft invoice created': (v) => v && v.length > 0 })) {
    return;
  }

  const t0 = Date.now();
  callKw('account.move', 'action_post', [invoiceIds]);
  dur.add(Date.now() - t0);

  const states = callKw('account.move', 'read', [invoiceIds, ['state']]);
  check(states, { 'post invoice: invoice is posted': (rows) => rows.every((r) => r.state === 'posted') });
}
