// Profit & Loss report.
import { Trend } from 'k6/metrics';
import { login } from '../../lib/odoo.js';
import { runReport } from '../../lib/report.js';
import { reportSummary } from '../../lib/summary.js';
import { loadOptions } from '../../config.js';

const optionsT = new Trend('report_profit_loss_options_ms', true);
const infoT = new Trend('report_profit_loss_info_ms', true);
export const options = loadOptions();
export const handleSummary = reportSummary([
  { slug: 'report-profit-loss:get_options', model: 'account.report', method: 'get_options', metric: 'report_profit_loss_options_ms' },
  { slug: 'report-profit-loss:get_report_information', model: 'account.report', method: 'get_report_information', metric: 'report_profit_loss_info_ms' },
]);

export default function () {
  login();
  runReport('profit_and_loss', 'account_reports.profit_and_loss', 'Profit and Loss', { options: optionsT, info: infoT });
}
