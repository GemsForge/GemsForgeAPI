#!/usr/bin/env bash
# Start GemsForgeAPI the way one Gem Life environment starts it, against a
# brand-new SQLite file, and prove that environment's database configuration:
#   1. the environment's own keys resolve (dev: DATABASE_PATH, fit: DATABASE_PATH_FIT,
#      prod: DATABASE_PATH_PROD, each with its LIVE_DATABASE_BACKUP_DIRECTORY*),
#   2. dev/fit: bootstrap backs up, applies every migration, verifies the schema,
#      and a second bootstrap is a safe no-op; prod: bootstrap is refused,
#   3. the server starts and answers /health,
#   4. unsafe settings are refused (missing prod key, prod backup == database,
#      dev/fit pointing at the production database).
# It never touches a real database; everything lives under .ci/db-validation/<env>.
#
# Usage: Scripts/validate-database-environment.sh <dev|fit|prod>
# Requires a prior `swift build --product GemsForgeAPI`.
set -euo pipefail

target=${1:-}
case $target in
  dev) suffix="" ;; fit) suffix="_FIT" ;; prod) suffix="_PROD" ;;
  *) echo "Usage: $0 <dev|fit|prod>" >&2; exit 2 ;;
esac

repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
bin="$(swift build --show-bin-path)/GemsForgeAPI"
[[ -x $bin ]] || { echo "Build first: swift build --product GemsForgeAPI" >&2; exit 2; }

root="$repo/.ci/db-validation/$target"
rm -rf "$root"
mkdir -p "$root/data" "$root/backups"
name="GemLife_DB_${target}.sqlite"
db="$root/data/$name"
sqlite3 "$db" "VACUUM;"
# A free port, so the check never talks to a server that is already running.
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')

# Start from a clean slate so nothing from the caller's shell leaks in.
# Always called in a subshell ($(...) or &); exec makes that subshell the
# process itself, so $! is the server's PID and kill reaches it.
clean_env() {
  exec env -u DATABASE_PATH -u DATABASE_PATH_FIT -u DATABASE_PATH_PROD \
      -u LIVE_DATABASE_BACKUP_DIRECTORY -u LIVE_DATABASE_BACKUP_DIRECTORY_FIT \
      -u LIVE_DATABASE_BACKUP_DIRECTORY_PROD GEMLIFE_ENVIRONMENT="$target" "$@"
}
configured() {
  local extra=()
  if [[ $target != prod ]]; then extra+=("DATABASE_PATH_PROD=$root/prod-guard/GemLife_DB_prod.sqlite"); fi
  clean_env "DATABASE_PATH${suffix}=$db" "LIVE_DATABASE_BACKUP_DIRECTORY${suffix}=$root/backups" ${extra[@]+"${extra[@]}"} "$@"
}
ok() { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

# 2. Migrations (dev/fit) or refusal (prod).
if [[ $target == prod ]]; then
  if out=$(configured "$bin" bootstrap-legacy-database --confirm-database-filename "$name" 2>&1); then
    fail "prod: bootstrap ran but must be restricted to dev and fit"
  fi
  grep -q "restricted to the dev and fit" <<<"$out" || fail "prod: unexpected bootstrap error: $out"
  ok "prod refuses the offline bootstrap"
else
  for pass in first second; do
    out=$(configured "$bin" bootstrap-legacy-database --confirm-database-filename "$name" 2>&1) \
      || fail "$target: bootstrap ($pass run) failed:\n$out"
    grep -q "Status: updated-and-verified" <<<"$out" || fail "$target: bootstrap ($pass run) did not verify:\n$out"
  done
  tables=$(sqlite3 "$db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
  migrations=$(sqlite3 "$db" "SELECT COUNT(*) FROM _fluent_migrations;")
  backups=$(find "$root/backups" -type f | wc -l | tr -d ' ')
  (( tables > 0 && migrations > 0 )) || fail "$target: schema missing after bootstrap"
  (( backups >= 2 )) || fail "$target: expected a backup before each bootstrap, found $backups"
  ok "$target migrations: $migrations applied, $tables tables, $backups backups; second run was a no-op"
fi

# 3. The server starts with this environment's configuration.
log="$root/serve.log"
configured "$bin" serve --hostname 127.0.0.1 --port "$port" >"$log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  if ! kill -0 "$server" 2>/dev/null; then cat "$log" >&2; fail "$target: server exited during startup"; fi
  if [[ $(curl -fsS "http://127.0.0.1:$port/health" 2>/dev/null) == ok ]]; then break; fi
  sleep 1
done
[[ $(curl -fsS "http://127.0.0.1:$port/health" 2>/dev/null) == ok ]] || { cat "$log" >&2; fail "$target: /health never answered"; }
kill -0 "$server" 2>/dev/null || { cat "$log" >&2; fail "$target: /health answered but this check's server is not running"; }
grep -q "database environment: $target" "$log" || fail "$target: server did not report environment $target"
kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; trap - EXIT
ok "$target server starts and answers /health"

# 4. Unsafe settings must stop startup.
refuses() {
  local label=$1 expected=$2; shift 2
  local refusal="$root/refusal.log"
  "$@" "$bin" serve --hostname 127.0.0.1 --port "$port" >"$refusal" 2>&1 &
  local pid=$!
  for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"; wait "$pid" 2>/dev/null || true
    fail "$target: started despite $label"
  fi
  if wait "$pid"; then fail "$target: exited cleanly instead of refusing $label"; fi
  grep -q "$expected" "$refusal" || { cat "$refusal" >&2; fail "$target: $label refused for the wrong reason"; }
  ok "$target refuses $label"
}
if [[ $target == prod ]]; then
  refuses "only the dev key (DATABASE_PATH) set" "DATABASE_PATH_PROD is required" \
    clean_env "DATABASE_PATH=$db" "LIVE_DATABASE_BACKUP_DIRECTORY=$root/backups"
  refuses "backup directory equal to the database" "must be different locations" \
    clean_env "DATABASE_PATH_PROD=$db" "LIVE_DATABASE_BACKUP_DIRECTORY_PROD=$db"
else
  refuses "the production database path" "cannot use the configured production database path" \
    clean_env "DATABASE_PATH${suffix}=$db" "LIVE_DATABASE_BACKUP_DIRECTORY${suffix}=$root/backups" "DATABASE_PATH_PROD=$db"
fi

rm -rf "$root"
echo "$target database configuration validated."
