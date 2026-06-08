// Writes one summary row per measured call to results/_run/<slug>.json, tagged
// with the run label. aggregate.js rolls these into results/summary.csv.
// k6 won't create the dir, so results/_run must already exist (run-all.sh does it).
import { CONFIG } from '../config.js';

const RUN_LABEL = CONFIG.runLabel;

function round(x) {
  return typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : '';
}

function val(metrics, name, key) {
  const m = metrics[name];
  return m && m.values && m.values[key] != null ? m.values[key] : '';
}

function pct(r) {
  return typeof r === 'number' ? `${Math.round(r * 1000) / 10}%` : 'n/a';
}

// Time fn, record elapsed ms into the trend, return fn's result.
export function time(trend, fn) {
  const t0 = Date.now();
  const r = fn();
  trend.add(Date.now() - t0);
  return r;
}

// Walk the (possibly nested) groups and yield every check.
function eachCheck(group, cb) {
  if (!group) return;
  const checks = group.checks || [];
  (Array.isArray(checks) ? checks : Object.values(checks)).forEach(cb);
  const groups = group.groups || [];
  (Array.isArray(groups) ? groups : Object.values(groups)).forEach((g) => eachCheck(g, cb));
}

function failedChecks(data) {
  const failed = [];
  eachCheck(data.root_group, (c) => {
    if (c.fails > 0) failed.push(`${c.name}: ${c.passes}/${c.passes + c.fails}`);
  });
  return failed;
}

const fileSafe = (s) => s.replace(/[^a-z0-9_-]/gi, '_');

function opLine(row) {
  return (
    `\n  ${row.test}  (${row.model}.${row.method})  [${RUN_LABEL}]\n` +
    `    iterations: ${row.iterations}   correctness: ${pct(row.correctness_pass_rate)}   errors: ${pct(row.http_req_failed_rate)}\n` +
    `    op avg/p95/max (ms): ${row.op_avg_ms} / ${row.op_p95_ms} / ${row.op_max_ms}\n`
  );
}

// ops: [{ slug, model, method, metric }] — one row per measured call.
export function reportSummary(ops) {
  return function (data) {
    const m = data.metrics || {};
    const correctness = val(m, 'checks', 'rate');
    const failedRate = val(m, 'http_req_failed', 'rate');
    const httpP95 = round(val(m, 'http_req_duration', 'p(95)'));
    const iters = val(m, 'iterations', 'count');

    const out = {};
    let stdout = '';
    for (const op of ops) {
      const t = (m[op.metric] && m[op.metric].values) || {};
      const row = {
        run_label: RUN_LABEL,
        test: op.slug,
        model: op.model,
        method: op.method,
        iterations: iters,
        correctness_pass_rate: correctness,
        http_req_failed_rate: failedRate,
        op_avg_ms: round(t.avg),
        op_p95_ms: round(t['p(95)']),
        op_max_ms: round(t.max),
        http_p95_ms: httpP95,
      };
      out[`results/_run/${fileSafe(op.slug)}.json`] = JSON.stringify(row);
      stdout += opLine(row);
    }

    const failed = failedChecks(data);
    if (failed.length) stdout += `    FAILED checks:\n${failed.map((f) => `      - ${f}`).join('\n')}\n`;
    out.stdout = stdout;
    return out;
  };
}
