#!/usr/bin/env bash
# Run the whole suite, then aggregate the results.
#   ODOO_DB=mydb ODOO_API_KEY=xxxx RUN_LABEL=admin ./run-all.sh
# RUN_LABEL tags the run so different creds can be compared later in summary.csv.
set -u
cd "$(dirname "$0")"

# fresh scratch dir so we only aggregate this run
mkdir -p results/_run
rm -f results/_run/*.json

TESTS=(
  tests/reports/trial-balance.js
  tests/reports/balance-sheet.js
  tests/reports/profit-loss.js
  tests/search/search-sales.js
  tests/search/search-journal-entry.js
  tests/search/search-journal-item.js
  tests/accounting/create-journal.js
  tests/accounting/post-journal.js
  tests/accounting/create-sales.js
  tests/accounting/confirm-sales.js
  tests/accounting/validate-do.js
  tests/accounting/post-invoice.js
  tests/accounting/post-payment.js
)

# forward env to every k6 run
ENV_ARGS=()
for v in ODOO_BASE_URL ODOO_DB ODOO_LOGIN ODOO_API_KEY RUN_LABEL SEARCH_TERM SEARCH_LIMIT VUS ITERATIONS DURATION; do
  if [[ -n "${!v:-}" ]]; then ENV_ARGS+=(-e "$v=${!v}"); fi
done

fail=0
for t in "${TESTS[@]}"; do
  echo ""
  echo "=================================================================="
  echo ">> k6 run ${t}"
  echo "=================================================================="
  if ! k6 run ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} "$t"; then
    echo "!! FAILED: $t"
    fail=1
  fi
done

echo ""
echo "=================================================================="
echo ">> Aggregating results"
echo "=================================================================="
node aggregate.js

exit "$fail"
