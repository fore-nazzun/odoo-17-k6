# Odoo 17 k6 tests

k6 scripts hitting Odoo 17 via the external JSON-RPC API (`/jsonrpc`) with an API
key. Set `env.json` once, then `k6 run <file>`.

## Tests

| Script | Model / method |
|---|---|
| `tests/reports/trial-balance.js` | `account.report` get_options + get_report_information |
| `tests/reports/balance-sheet.js` | `account.report` |
| `tests/reports/profit-loss.js` | `account.report` |
| `tests/search/search-sales.js` | `sale.order.web_search_read` |
| `tests/search/search-journal-entry.js` | `account.move.web_search_read` |
| `tests/search/search-journal-item.js` | `account.move.line.web_search_read` |
| `tests/accounting/create-journal.js` | `account.journal.create` |
| `tests/accounting/post-journal.js` | `account.move.action_post` |
| `tests/accounting/create-sales.js` | `sale.order.create` |
| `tests/accounting/confirm-sales.js` | `sale.order.action_confirm` |
| `tests/accounting/validate-do.js` | `stock.picking.button_validate` |
| `tests/accounting/post-invoice.js` | `sale.advance.payment.inv.create_invoices` + `account.move.action_post` |
| `tests/accounting/post-payment.js` | `account.payment.register.action_create_payments` |

Prerequisites for the stateful tests are built in a `group('setup')`; only the
target call goes into the `*_ms` metric.

## Setup

Needs k6 and an Odoo 17 instance with accounting set up. Create an API key in
Odoo (Preferences > Account Security > New API Key), then:

```bash
cp env.example.json env.json   # fill in ODOO_BASE_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY
```

`env.json` is git-ignored. `-e KEY=value` or shell env override it per run.

| Key | Default | Notes |
|---|---|---|
| `ODOO_BASE_URL` | `http://localhost:8069` | Odoo URL |
| `ODOO_DB` | | database (guarded, see below) |
| `ODOO_LOGIN` | `admin` | login |
| `ODOO_API_KEY` | | required, used as password |
| `ODOO_COMPANY_ID` | (user default) | pins `allowed_company_ids` |
| `ODOO_TIMEOUT` | `120s` | per-request timeout |
| `RUN_LABEL` | `default` | label for comparing runs |
| `SEARCH_TERM` | (all) | search text |
| `SEARCH_LIMIT` | `80` | rows fetched |
| `VUS` | `1` | virtual users |
| `ITERATIONS` | `1` | iterations (ignored if `DURATION` set) |
| `DURATION` | | run for a time, e.g. `30s` |
| `MAX_DURATION` | `60m` | whole-run cap for iterations mode |

`ODOO_DB` must contain `fore_odoo_17`, `fore-odoo-16`, or `staging`, otherwise the
run aborts — these write tests must not hit production.

## Running

```bash
k6 run tests/search/search-sales.js          # one test
k6 run -e VUS=10 -e DURATION=1m tests/reports/balance-sheet.js   # load test
./run-all.sh                                  # everything, then aggregate
```

## Results

`run-all.sh` aggregates each test into two CSVs under `results/` (open in Excel):

- `summary.csv` — full history, one row per call per run:
  `run_label, base_url, login, company_id, test, model, method, iterations,
  correctness_pass_rate, http_req_failed_rate, op_avg_ms, op_p95_ms, op_max_ms,
  http_p95_ms`.
- `comparison.csv` — side-by-side p95, one column per `RUN_LABEL`.

Set `RUN_LABEL` per run to compare (e.g. different credentials):

```bash
RUN_LABEL=admin     ODOO_API_KEY=$KEY_ADMIN ./run-all.sh
RUN_LABEL=sales_mgr ODOO_API_KEY=$KEY_SALES ./run-all.sh
```

Multi-call operations span several rows (e.g. `…:get_options` and
`…:get_report_information`); `op_*_ms` is per call, not a sum.

## Notes

- Write tests create real records each iteration — use a test/staging DB.
- Reports need Enterprise `account_reports`; a missing report id shows as a failed check.
- `validate-do` needs Inventory, a storable product, and stock.

## Layout

```
config.js     loads env.json, db guard
lib/odoo.js   JSON-RPC client (login, callKw, webSearchRead)
lib/data.js   record setup helpers
lib/search.js search-bar domain
lib/report.js account.report engine
lib/summary.js per-call summary rows
tests/        the 13 tests
run-all.sh    run all, then aggregate
aggregate.js  build summary.csv + comparison.csv
```
