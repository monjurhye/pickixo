#!/usr/bin/env bash
#
# Run the API integration tests against a throwaway database.
#
#   bash scripts/test-api.sh
#
# WHY THIS SCRIPT EXISTS
#
# The suite creates accounts, and accounts are rows in whatever database the API
# is attached to. There is one API process and one database on this machine, so
# running the tests "locally" wrote junk users straight into the live table —
# twice, a few hundred rows, before the pattern was obvious. Pointing the tests
# at localhost was never the fix; they need a database of their own.
#
# This builds one, starts a second API against it on 8011, runs the suite, and
# tears both down. The live API on 8010 and the pickixo database are untouched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG="/c/Pickixo/pgsql/bin"
TEST_DB="pickixo_test"
TEST_PORT=8011

read_env() { grep -E "^$1=" "$ROOT/.env" | head -1 | cut -d= -f2-; }

APP_DB_URL="$(read_env DATABASE_URL)"
# Reuse the application role and its password; only the database name differs.
TEST_DB_URL="${APP_DB_URL%/*}/$TEST_DB"

echo "==> rebuilding $TEST_DB from database/schema"
# The superuser password is not in .env by design; PGPASSWORD must be supplied.
: "${PGPASSWORD:?set PGPASSWORD to the pickixo_admin password first}"
PSQL="$PG/psql.exe -h 127.0.0.1 -U pickixo_admin -q -v ON_ERROR_STOP=1"

$PSQL -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"
$PSQL -d postgres -c "CREATE DATABASE $TEST_DB OWNER pickixo_admin ENCODING 'UTF8';"
for f in "$ROOT"/database/schema/00*.sql; do
    $PSQL -d "$TEST_DB" -f "$f" 2>&1 | grep -vE 'NOTICE|^$' || true
done

echo "==> starting a test API on $TEST_PORT"
cd "$ROOT/apps/api"
# SESSION_COOKIE_SECURE=false so the session cookies survive a plain-HTTP
# round trip; APP_ENV=development so the production guard does not fire and the
# API does not demand an https SITE_URL.
APP_ENV=development \
BACKEND_PORT=$TEST_PORT \
SESSION_COOKIE_SECURE=false \
SITE_URL="http://localhost:$TEST_PORT" \
DATABASE_URL="$TEST_DB_URL" \
./.venv/Scripts/python.exe run.py &
API_PID=$!

cleanup() {
    echo "==> stopping the test API"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
    curl -s --max-time 2 "http://127.0.0.1:$TEST_PORT/api/health" >/dev/null 2>&1 && break
    sleep 1
done

echo "==> running the suite"
PICKIXO_API="http://127.0.0.1:$TEST_PORT/api" ./.venv/Scripts/python.exe -m tests.test_api_flows
