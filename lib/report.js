// Runs a financial report (account_reports). get_options and
// get_report_information are timed separately into the trends passed in.
import { check } from 'k6';
import { callKw, xmlIdToResId } from './odoo.js';
import { time } from './summary.js';

export function runReport(label, xmlid, reportName, trends) {
  const [mod, name] = xmlid.split('.');
  const reportId = xmlIdToResId(mod, name);
  if (!check(reportId, { [`${label}: report '${reportName}' found`]: (id) => !!id })) return;

  const options = time(trends.options, () => callKw('account.report', 'get_options', [[reportId], {}]));
  const info = time(trends.info, () => callKw('account.report', 'get_report_information', [[reportId], options]));

  check(info, {
    [`${label}: report computed`]: (i) => i && typeof i === 'object',
    [`${label}: report has lines`]: (i) => i && Array.isArray(i.lines),
  });
}
