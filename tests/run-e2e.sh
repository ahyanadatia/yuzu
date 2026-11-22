#!/bin/sh
# Runs the two-phone end-to-end test against a throwaway local Postgres and checks its output.
# Needs: PostgreSQL server binaries, psql, Google Chrome at /usr/bin/google-chrome, and
# python3 with playwright, pillow and psycopg2. Set E2E_OUT to keep the screenshots.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
WORK="$(mktemp -d)"
AS=""
if [ "$(id -u)" = 0 ]; then AS="runuser -u postgres --"; chmod 755 "$WORK"; fi  # Postgres refuses to run as root

cleanup() {
  [ -f "$WORK/shim.pid" ] && kill "$(cat "$WORK/shim.pid")" 2>/dev/null || true
  $AS "$PGBIN/pg_ctl" -D "$WORK/pg" -m immediate stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

cp -r "$ROOT/src" "$ROOT/tests" "$ROOT/build.sh" "$ROOT/supabase.sql" "$WORK/"
(cd "$WORK" && SUPABASE_URL=http://localhost:8787 SUPABASE_KEY=local-test-key ./build.sh >/dev/null)

mkdir "$WORK/pg"; [ -n "$AS" ] && chown postgres "$WORK/pg"
$AS "$PGBIN/initdb" -D "$WORK/pg" -U pg -A trust >/dev/null
$AS "$PGBIN/pg_ctl" -D "$WORK/pg" -o "-p 5544 -k /tmp -c listen_addresses=''" -l "$WORK/pg/server.log" -w start >/dev/null
# The roles and schema Supabase provides out of the box.
psql -h /tmp -p 5544 -U pg -d postgres -q -v ON_ERROR_STOP=1 \
  -c "create role anon nologin; create role authenticated nologin; create schema extensions; grant usage on schema extensions to public;"
sed "s/CHANGE-ME/TEST-CODE/" "$WORK/supabase.sql" | psql -h /tmp -p 5544 -U pg -d postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1

(cd "$WORK" && python3 tests/shim.py "$WORK" >"$WORK/shim.log" 2>&1 & echo $! >"$WORK/shim.pid")
sleep 2

(cd "$WORK" && python3 tests/e2e.py) | tee "$WORK/e2e.out"
if [ -n "${E2E_OUT:-}" ]; then mkdir -p "$E2E_OUT"; cp "$WORK"/tests/*.png "$E2E_OUT"/; fi

fail=0
while IFS= read -r want; do
  grep -qF -- "$want" "$WORK/e2e.out" || { echo "MISSING: $want"; fail=1; }
done <<'WANT'
bad code -> That invite code isn't right.
A goals: 4
dup phone -> That number has already joined.
dup name -> That name is already in the league.
B league rows: 2
A after reload, day state: DAY VERIFIED
wrong pin -> That number and PIN don't match.
A back in: 4 goals
errors: []
WANT
[ "$fail" = 0 ] && echo "e2e ok" || { echo "e2e FAILED"; exit 1; }
