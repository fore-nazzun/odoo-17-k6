#!/usr/bin/env node
// Roll the per-test rows from results/_run/*.json into:
//   results/summary.csv     append-only history (one row per op per run)
//   results/comparison.csv  pivot of p95 by run_label (the side-by-side view)
// Run by run-all.sh after the suite finishes.
const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, 'results');
const RUN_DIR = path.join(RESULTS, '_run');
const SUMMARY = path.join(RESULTS, 'summary.csv');
const COMPARISON = path.join(RESULTS, 'comparison.csv');

const COLUMNS = [
  'run_label', 'base_url', 'login', 'company_id', 'test', 'model', 'method', 'iterations',
  'correctness_pass_rate', 'http_req_failed_rate',
  'op_avg_ms', 'op_p95_ms', 'op_max_ms', 'http_p95_ms',
];

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLine = (arr) => arr.map(csvCell).join(',');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Read a CSV into row objects keyed by its own header, so an older summary.csv
// with a different column set still maps cleanly (missing columns -> '').
function readRows(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    header.forEach((h, i) => (obj[h] = cells[i]));
    return obj;
  });
}

// rows from this run
if (!fs.existsSync(RUN_DIR)) {
  console.error(`No ${RUN_DIR} found, nothing to aggregate.`);
  process.exit(0);
}
const newRows = fs
  .readdirSync(RUN_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(RUN_DIR, f), 'utf8')));
if (!newRows.length) {
  console.error('No per-test rows to aggregate.');
  process.exit(0);
}

// Rewrite summary.csv: existing history + this run, always in the current schema.
const allRows = readRows(SUMMARY).concat(newRows);
const summary = [csvLine(COLUMNS)].concat(allRows.map((r) => csvLine(COLUMNS.map((c) => r[c]))));
fs.writeFileSync(SUMMARY, summary.join('\n') + '\n');
console.log(`Added ${newRows.length} rows (${allRows.length} total) to ${path.relative(__dirname, SUMMARY)}`);

// rebuild comparison.csv (op x label, p95). Rows are in run order, so the last
// row for a given test+label is the most recent run and wins.
const labels = [];
const byTest = {};
for (const r of allRows) {
  const label = r.run_label;
  if (!labels.includes(label)) labels.push(label);
  byTest[r.test] = byTest[r.test] || { model: r.model, method: r.method, vals: {} };
  byTest[r.test].model = r.model;
  byTest[r.test].method = r.method;
  byTest[r.test].vals[label] = r.op_p95_ms;
}

const lines = [csvLine(['operation', 'model', 'method', ...labels.map((l) => `${l}_p95_ms`)])];
for (const test of Object.keys(byTest).sort()) {
  lines.push(csvLine([test, byTest[test].model, byTest[test].method, ...labels.map((l) => byTest[test].vals[l] || '')]));
}
fs.writeFileSync(COMPARISON, lines.join('\n') + '\n');
console.log(`Wrote ${path.relative(__dirname, COMPARISON)} (${labels.length} label(s): ${labels.join(', ')})`);
