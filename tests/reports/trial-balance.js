// Trial Balance report.
import { Trend } from 'k6/metrics';
import { login } from '../../lib/odoo.js';
import { runReport } from '../../lib/report.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const optionsT = new Trend('report_trial_balance_options_ms', true);
const infoT = new Trend('report_trial_balance_info_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'report-trial-balance:get_options', model: 'account.report', method: 'get_options', metric: 'report_trial_balance_options_ms' },
  { slug: 'report-trial-balance:get_report_information', model: 'account.report', method: 'get_report_information', metric: 'report_trial_balance_info_ms' },
]);

export default function () {
  login();
  runReport('trial_balance', 'account_reports.trial_balance_report', 'Trial Balance', { options: optionsT, info: infoT });
}
