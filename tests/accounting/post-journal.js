// Post a journal entry (account.move.action_post).
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { login, callKw } from '../../lib/odoo.js';
import { createJournalEntry } from '../../lib/data.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('post_journal_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'post-journal', model: 'account.move', method: 'action_post', metric: 'post_journal_ms' },
]);

export default function () {
  login();

  let moveId;
  group('setup', () => {
    moveId = createJournalEntry(100);
  });
  check(moveId, { 'post journal: draft entry created': (v) => Number.isInteger(v) && v > 0 });

  const t0 = Date.now();
  callKw('account.move', 'action_post', [[moveId]]);
  dur.add(Date.now() - t0);

  const state = callKw('account.move', 'read', [[moveId], ['state']])[0].state;
  check(state, { 'post journal: state is posted': (s) => s === 'posted' });
}
