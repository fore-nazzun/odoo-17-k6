// Create a journal (account.journal).
import { Trend } from 'k6/metrics';
import { check } from 'k6';
import { login, callKw } from '../../lib/odoo.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const dur = new Trend('create_journal_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'create-journal', model: 'account.journal', method: 'create', metric: 'create_journal_ms' },
]);

// code is max 5 chars and unique per company. Seed with the clock so reruns
// don't collide with journals from a previous run.
let seq = 0;
function nextCode() {
  seq += 1;
  const n = (Date.now() + __VU * 131 + seq * 7) % 36 ** 5;
  return n.toString(36).toUpperCase().padStart(5, '0');
}

export default function () {
  login();
  const code = nextCode();

  const t0 = Date.now();
  const id = callKw('account.journal', 'create', [
    { name: `k6 Journal ${code}`, code: code, type: 'general' },
  ]);
  dur.add(Date.now() - t0);

  check(id, { 'create journal: id returned': (v) => Number.isInteger(v) && v > 0 });
}
