// Finds / creates the records the accounting tests need. Called from a
// group('setup') so the prep work stays out of the measured timings.
import { fail } from 'k6';
import { callKw, searchRead } from './odoo.js';

export function pickCustomer() {
  let rows = searchRead('res.partner', [['customer_rank', '>', 0]], ['id'], { limit: 1 });
  if (!rows.length) rows = searchRead('res.partner', [['type', '=', 'contact']], ['id'], { limit: 1 });
  if (!rows.length) fail('No partner found to use as customer.');
  return rows[0].id;
}

// storable=true -> stockable product (needed to get a delivery order).
// orderPolicy=true -> invoice_policy 'order', so it can be invoiced right after
// confirm without delivering first.
export function pickProduct(storable = false, orderPolicy = false) {
  const domain = [['sale_ok', '=', true]];
  if (storable) domain.push(['type', '=', 'product']);
  if (orderPolicy) domain.push(['invoice_policy', '=', 'order']);
  const rows = searchRead('product.product', domain, ['id'], { limit: 1 });
  if (!rows.length) {
    fail(
      orderPolicy
        ? "No sellable product with invoice policy 'Ordered quantities' found."
        : 'No matching sellable product found.'
    );
  }
  return rows[0].id;
}

// Balanced draft journal entry, returns its id. Journal and both accounts are
// taken from the same company to avoid cross-company errors.
export function createJournalEntry(amount = 100) {
  const journal = searchRead('account.journal', [['type', '=', 'general']], ['id', 'company_id'], { limit: 1 })[0];
  if (!journal) fail("No journal of type 'general' found.");
  const companyId = journal.company_id[0];
  const accs = searchRead(
    'account.account',
    [['company_id', '=', companyId], ['deprecated', '=', false]],
    ['id'],
    { limit: 2, order: 'code' }
  );
  if (accs.length < 2) fail('Need at least two GL accounts in the journal company.');
  return callKw('account.move', 'create', [
    {
      move_type: 'entry',
      journal_id: journal.id,
      ref: `k6 entry ${amount}`,
      line_ids: [
        [0, 0, { account_id: accs[0].id, name: 'k6 debit', debit: amount, credit: 0 }],
        [0, 0, { account_id: accs[1].id, name: 'k6 credit', debit: 0, credit: amount }],
      ],
    },
  ]);
}

// Draft sale order with one line, returns its id.
export function createSaleOrder(storable = false, qty = 1, orderPolicy = false) {
  const partnerId = pickCustomer();
  const productId = pickProduct(storable, orderPolicy);
  return callKw('sale.order', 'create', [
    { partner_id: partnerId, order_line: [[0, 0, { product_id: productId, product_uom_qty: qty }]] },
  ]);
}

export function confirmSaleOrder(orderId) {
  callKw('sale.order', 'action_confirm', [[orderId]]);
  return orderId;
}

// Invoice a confirmed order via the public wizard, returns the invoice ids.
export function invoiceSaleOrder(orderId) {
  const ctx = { active_model: 'sale.order', active_ids: [orderId], active_id: orderId };
  const wizId = callKw('sale.advance.payment.inv', 'create', [{}], { context: ctx });
  callKw('sale.advance.payment.inv', 'create_invoices', [[wizId]], { context: ctx });
  const moveIds = callKw('sale.order', 'read', [[orderId], ['invoice_ids']])[0].invoice_ids || [];
  if (!moveIds.length) fail('Sale order produced no invoice (nothing to invoice?).');
  return moveIds;
}
