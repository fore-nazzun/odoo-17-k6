// Register + post a payment for a posted invoice (account.payment.register).
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login, callKw } from '../../lib/odoo.js';
import { createSaleOrder, confirmSaleOrder, invoiceSaleOrder } from '../../lib/data.js';
import { reportSummary, time } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const createT = new Trend('post_payment_create_ms', true);
const postT = new Trend('post_payment_post_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'post-payment:create', model: 'account.payment.register', method: 'create', metric: 'post_payment_create_ms' },
  { slug: 'post-payment:action_create_payments', model: 'account.payment.register', method: 'action_create_payments', metric: 'post_payment_post_ms' },
]);

export default function () {
  login();

  let invoiceId;
  group('setup', () => {
    const orderId = createSaleOrder(false, 1, true);
    confirmSaleOrder(orderId);
    const invoiceIds = invoiceSaleOrder(orderId);
    callKw('account.move', 'action_post', [invoiceIds]);
    invoiceId = invoiceIds[0];
  });
  if (!check(invoiceId, { 'post payment: posted invoice ready': (v) => Number.isInteger(v) && v > 0 })) {
    return;
  }

  // wizard pulls amount/journal from the invoice in context; action_create_payments
  // both creates and posts the payment
  const ctx = { active_model: 'account.move', active_ids: [invoiceId], active_id: invoiceId };

  const wizId = time(createT, () => callKw('account.payment.register', 'create', [{}], { context: ctx }));
  time(postT, () => callKw('account.payment.register', 'action_create_payments', [[wizId]], { context: ctx }));

  const state = callKw('account.move', 'read', [[invoiceId], ['payment_state']])[0].payment_state;
  check(state, {
    'post payment: invoice paid/in_payment': (s) => s === 'paid' || s === 'in_payment' || s === 'partial',
  });
}
