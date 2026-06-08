// Search sales orders, like typing in the search bar. -e SEARCH_TERM=S0001
import { Trend, Counter } from 'k6/metrics';
import { check } from 'k6';
import { login, webSearchRead } from '../../lib/odoo.js';
import { ilikeOr } from '../../lib/search.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions, CONFIG } from '../../config.js';

const dur = new Trend('search_sales_ms', true);
const hits = new Counter('search_sales_records');
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'search-sales', model: 'sale.order', method: 'web_search_read', metric: 'search_sales_ms' },
]);

const SPEC = {
  name:         {},
  date_order:   {},
  amount_total: {},
  state:        {},
  partner_id:   { fields: { display_name: {} } },
};

export default function () {
  login();
  const domain = ilikeOr(CONFIG.searchTerm, ['name', 'partner_id', 'client_order_ref']);

  const t0 = Date.now();
  const res = webSearchRead('sale.order', domain, SPEC, { limit: CONFIG.searchLimit, order: 'date_order desc' });
  dur.add(Date.now() - t0);

  check(res, { 'search sales: returned a result set': (r) => r && Array.isArray(r.records) });
  if (res && res.records) hits.add(res.records.length);
}
