# Odoo 17 k6 tests

k6 scripts that hit Odoo 17 over the external JSON-RPC API (`/jsonrpc`) using an
API key. Each VU authenticates once to get its uid, then calls the ORM directly.
Same scripts work for a quick smoke check (`iterations=1`) or a load test
(`VUS` / `DURATION`).

Put your settings in `env.json` once and runs are just `k6 run <file>`.

## Tests

| Script | What it does | Model / method |
|---|---|---|
| `tests/reports/trial-balance.js` | Trial Balance report | `account.report` get_options + get_report_information |
| `tests/reports/balance-sheet.js` | Balance Sheet report | `account.report` |
| `tests/reports/profit-loss.js` | Profit & Loss report | `account.report` |
| `tests/search/search-sales.js` | Search sales orders | `sale.order.web_search_read` |
| `tests/search/search-journal-entry.js` | Search journal entries | `account.move.web_search_read` |
| `tests/search/search-journal-item.js` | Search journal items | `account.move.line.web_search_read` |
| `tests/accounting/create-journal.js` | Create a journal | `account.journal.create` |
| `tests/accounting/post-journal.js` | Post a journal entry | `account.move.action_post` |
| `tests/accounting/create-sales.js` | Create a sales order | `sale.order.create` |
| `tests/accounting/confirm-sales.js` | Confirm a sales order | `sale.order.action_confirm` |
| `tests/accounting/validate-do.js` | Validate the delivery order | `stock.picking.button_validate` |
| `tests/accounting/post-invoice.js` | Post the customer invoice | `sale.advance.payment.inv.create_invoices` + `account.move.action_post` |
| `tests/accounting/post-payment.js` | Register + post a payment | `account.payment.register.action_create_payments` |

For the stateful tests, the prerequisites are built inside a `group('setup')`
(e.g. confirm-sales first creates a draft order). Only the target operation goes
into that test's `*_ms` timing metric, so setup time doesn't skew the numbers.

## Setup

You need:

- k6 (tested on v1.1.0)
- An Odoo 17 instance with accounting set up (chart of accounts, at least one
  customer and one sellable product).
- An API key for the test user: Odoo > Preferences > Account Security > New API
  Key.

Copy the example config and fill it in:

```bash
cp env.example.json env.json
# edit env.json: ODOO_BASE_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY
```

`env.json` is git-ignored. Once it's set, `k6 run <file>` needs no flags. You can
still override any value per run with `-e KEY=value` or a shell env var (those win
over the file). Available keys:

| Key | Default | Notes |
|---|---|---|
| `ODOO_BASE_URL` | `http://localhost:8069` | Odoo URL |
| `ODOO_DB` | | database (see the guard below) |
| `ODOO_LOGIN` | `admin` | login (used to get the uid) |
| `ODOO_API_KEY` | | required, used as the password |
| `ODOO_COMPANY_ID` | (user default) | company to run in; pins `allowed_company_ids` |
| `ODOO_TIMEOUT` | `120s` | per-request timeout (raise for heavy reports) |
| `RUN_LABEL` | `default` | label for this run, for comparing |
| `SEARCH_TERM` | (all) | text for the search tests |
| `SEARCH_LIMIT` | `80` | rows the search fetches |
| `VUS` | `1` | virtual users |
| `ITERATIONS` | `1` | iterations (ignored if `DURATION` set) |
| `DURATION` | | run for a time instead, e.g. `30s`, `2m` |

The DB name is guarded: it must contain `fore_odoo_17`, `fore-odoo-16`, or
`staging`. Anything else aborts before the test starts, so these write tests
can't accidentally run against production.

## Running

With `env.json` set, one test is just:

```bash
k6 run tests/search/search-sales.js
```

Override per run when you need to (e.g. a quick load test):

```bash
k6 run -e VUS=10 -e DURATION=1m tests/reports/balance-sheet.js
```

Everything, then aggregate:

```bash
./run-all.sh
```

## Comparing runs

Each test writes a summary row, and `run-all.sh` calls `aggregate.js` to collect
them. Set `RUN_LABEL` to whatever you're testing (a credential, a role, a
version) so you can line runs up next to each other. Either edit `env.json`
between runs, or override per run:

```bash
RUN_LABEL=admin     ODOO_API_KEY=$KEY_ADMIN ./run-all.sh
RUN_LABEL=sales_mgr ODOO_API_KEY=$KEY_SALES ./run-all.sh
```

You get two CSVs under `results/` (open them in Excel or Sheets):

- `results/summary.csv` keeps the full history, one row per measured call per run:
  run_label, test, model, method, iterations, correctness_pass_rate,
  http_req_failed_rate, op_avg_ms, op_p95_ms, op_max_ms, http_p95_ms.
  Pivot by run_label.
- `results/comparison.csv` is the quick side-by-side: one row per call, one p95
  column per label (latest run wins per label).

Multi-call operations are broken down per call, so they span several rows: e.g.
the reports have `…:get_options` and `…:get_report_information`, and post-payment
has `…:create` and `…:action_create_payments`. `op_*_ms` is the time of that one
call (not a sum).

To run a single test and still get a row:

```bash
mkdir -p results/_run
k6 run tests/reports/balance-sheet.js
node aggregate.js
```

## Notes

- The create/post/confirm/validate/payment tests write real records, one set per
  iteration. Run them against a test or staging database, not production.
- Reports use the `account_reports` engine. The report ids come from their XML
  ids (`account_reports.trial_balance_report`, `account_reports.balance_sheet`,
  `account_reports.profit_and_loss`); a missing one shows up as a failed check
  rather than a crash.
- validate-do needs the Inventory app, a storable product, and a warehouse with
  stock. If no delivery is generated it exits early with a failed check.
- Thresholds are set per test (see each script and `config.js`). Tune to your SLOs.

## Layout

```
env.example.json   copy to env.json and fill in
config.js          loads env.json, connection + load knobs, db guard
lib/odoo.js        JSON-RPC client: login, callKw, webSearchRead, ...
lib/data.js        record setup helpers
lib/search.js      builds the search-bar domain
lib/report.js      runs the account.report engine
lib/summary.js     per-test summary row for comparison
tests/             the 13 tests
run-all.sh         run everything, then aggregate
aggregate.js       build summary.csv + comparison.csv
results/           generated CSVs (git-ignored)
```
