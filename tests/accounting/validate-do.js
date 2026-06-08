// Validate the delivery order from a confirmed sale (stock.picking.button_validate).
// Needs Inventory + a storable product + a warehouse with stock.
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login, callKw, callKwSafe, searchRead } from '../../lib/odoo.js';
import { createSaleOrder, confirmSaleOrder } from '../../lib/data.js';
import { reportSummary, time } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('validate_do_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'validate-do', model: 'stock.picking', method: 'button_validate', metric: 'validate_do_ms' },
]);

export default function () {
  login();

  let pickingIds = [];
  group('setup', () => {
    const orderId = createSaleOrder(true, 1); // storable -> gets a delivery
    confirmSaleOrder(orderId);
    pickingIds = callKw('sale.order', 'read', [[orderId], ['picking_ids']])[0].picking_ids || [];
  });
  if (!check(pickingIds, { 'validate DO: delivery picking exists': (p) => p && p.length > 0 })) {
    return; // nothing to validate
  }

  for (const pid of pickingIds) {
    // reserve + set done qty (prep, not timed)
    callKwSafe('stock.picking', 'action_assign', [[pid]]);
    const moves = searchRead('stock.move', [['picking_id', '=', pid]], ['id', 'product_uom_qty']);
    for (const m of moves) {
      // in 17, `quantity` is the done qty and `picked` marks the line handled
      callKw('stock.move', 'write', [[m.id], { quantity: m.product_uom_qty, picked: true }]);
    }

    const res = time(dur, () => callKwSafe('stock.picking', 'button_validate', [[pid]]));
    // a returned action dict is usually the backorder confirmation wizard
    if (res.ok && res.value && typeof res.value === 'object' && res.value.res_model === 'stock.backorder.confirmation') {
      const ctx = (res.value.context) || { active_ids: [pid], active_model: 'stock.picking' };
      const wizId = callKw('stock.backorder.confirmation', 'create', [{ pick_ids: [[6, 0, [pid]]] }], { context: ctx });
      callKwSafe('stock.backorder.confirmation', 'process', [[wizId]]);
    }
  }

  const states = callKw('stock.picking', 'read', [pickingIds, ['state']]);
  check(states, { 'validate DO: all pickings done': (rows) => rows.every((r) => r.state === 'done') });
}
