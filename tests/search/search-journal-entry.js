// Search journal entries (account.move, move_type=entry). -e SEARCH_TERM=MISC
import { Trend, Counter } from 'k6/metrics';
import { check } from 'k6';
import { login, webSearchRead } from '../../lib/odoo.js';
import { ilikeOr } from '../../lib/search.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions, CONFIG } from '../../config.js';

const dur = new Trend('search_journal_entry_ms', true);
const hits = new Counter('search_journal_entry_records');
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'search-journal-entry', model: 'account.move', method: 'web_search_read', metric: 'search_journal_entry_ms' },
]);

const SPEC = {
  name:         {},
  date:         {},
  ref:          {},
  state:        {},
  amount_total: {},
  journal_id:   { fields: { display_name: {} } },
  partner_id:   { fields: { display_name: {} } },
};

export default function () {
  login();
  const domain = [['move_type', '=', 'entry']].concat(ilikeOr(CONFIG.searchTerm, ['name', 'ref', 'partner_id']));

  const t0 = Date.now();
  const res = webSearchRead('account.move', domain, SPEC, { limit: CONFIG.searchLimit, order: 'date desc' });
  dur.add(Date.now() - t0);

  check(res, { 'search journal entry: returned a result set': (r) => r && Array.isArray(r.records) });
  if (res && res.records) hits.add(res.records.length);
}
