// Search journal items (account.move.line). -e SEARCH_TERM=40000
import { Trend, Counter } from 'k6/metrics';
import { check } from 'k6';
import { login, webSearchRead } from '../../lib/odoo.js';
import { ilikeOr } from '../../lib/search.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions, CONFIG } from '../../config.js';

const dur = new Trend('search_journal_item_ms', true);
const hits = new Counter('search_journal_item_records');
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'search-journal-item', model: 'account.move.line', method: 'web_search_read', metric: 'search_journal_item_ms' },
]);

const SPEC = {
  name: {},
  date: {},
  ref: {},
  debit: {},
  credit: {},
  balance: {},
  account_id: { fields: { display_name: {} } },
  move_id: { fields: { display_name: {} } },
  partner_id: { fields: { display_name: {} } },
};

export default function () {
  login();
  const domain = ilikeOr(CONFIG.searchTerm, ['name', 'ref', 'move_id', 'account_id', 'partner_id']);

  const t0 = Date.now();
  const res = webSearchRead('account.move.line', domain, SPEC, { limit: CONFIG.searchLimit, order: 'date desc' });
  dur.add(Date.now() - t0);

  check(res, { 'search journal item: returned a result set': (r) => r && Array.isArray(r.records) });
  if (res && res.records) hits.add(res.records.length);
}
