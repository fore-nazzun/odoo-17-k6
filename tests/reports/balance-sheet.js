// Balance Sheet report.
import { Trend } from 'k6/metrics';
import { login } from '../../lib/odoo.js';
import { runReport } from '../../lib/report.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const optionsT = new Trend('report_balance_sheet_options_ms', true);
const infoT = new Trend('report_balance_sheet_info_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'report-balance-sheet:get_options', model: 'account.report', method: 'get_options', metric: 'report_balance_sheet_options_ms' },
  { slug: 'report-balance-sheet:get_report_information', model: 'account.report', method: 'get_report_information', metric: 'report_balance_sheet_info_ms' },
]);

export default function () {
  login();
  runReport('balance_sheet', 'account_reports.balance_sheet', 'Balance Sheet', { options: optionsT, info: infoT });
}
