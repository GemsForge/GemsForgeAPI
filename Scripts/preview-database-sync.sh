#!/usr/bin/env bash
set -Eeuo pipefail

source_database="${1:-}"
dev_database="${2:-}"
fit_database="${3:-}"
backup_directory="${4:-}"

if [[ -z "$source_database" || -z "$dev_database" || -z "$fit_database" || -z "$backup_directory" ]]; then
  echo "Usage: $0 SOURCE_DATABASE DEV_DATABASE FIT_DATABASE BACKUP_DIRECTORY" >&2
  exit 64
fi

for database in "$source_database" "$dev_database" "$fit_database"; do
  [[ -f "$database" ]] || { echo "Database does not exist: $database" >&2; exit 66; }
done

source_absolute="$(cd "$(dirname "$source_database")" && pwd)/$(basename "$source_database")"
dev_absolute="$(cd "$(dirname "$dev_database")" && pwd)/$(basename "$dev_database")"
fit_absolute="$(cd "$(dirname "$fit_database")" && pwd)/$(basename "$fit_database")"

[[ "$source_absolute" != "$dev_absolute" && "$source_absolute" != "$fit_absolute" && "$dev_absolute" != "$fit_absolute" ]] || {
  echo "Source and target databases must be three different files." >&2
  exit 65
}
[[ "$(basename "$dev_database")" == "GemLife_DB_dev.sqlite" ]] || { echo "Refusing non-dev target: $dev_database" >&2; exit 65; }
[[ "$(basename "$fit_database")" == "GemLife_DB_fit.sqlite" ]] || { echo "Refusing non-fit target: $fit_database" >&2; exit 65; }

mkdir -p "$backup_directory"
timestamp="$(date +%Y%m%d-%H%M%S)"

backup_target() {
  local target="$1"
  local label="$2"
  local backup="$backup_directory/GemLife_DB_${label}-before-sync-${timestamp}.sqlite"
  cp -p "$target" "$backup"
  [[ -s "$backup" ]] || { echo "Backup verification failed: $backup" >&2; exit 74; }
  echo "BACKUP $label $backup ($(stat -f%z "$backup") bytes)"
}

backup_target "$dev_database" dev
backup_target "$fit_database" fit

tables=(Addresses Domains Education Employment Transactions Services FileMetadata ForgeKeeper GemHues HomeInventory)
echo "PLAN source=$source_absolute"
echo "PLAN dev=$dev_absolute"
echo "PLAN fit=$fit_absolute"
echo "PLAN target_writes=0"
printf 'TABLE\tSOURCE\tDEV\tFIT\n'
for table in "${tables[@]}"; do
  source_count="$(sqlite3 "$source_database" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo MISSING)"
  dev_count="$(sqlite3 "$dev_database" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo MISSING)"
  fit_count="$(sqlite3 "$fit_database" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo MISSING)"
  printf '%s\t%s\t%s\t%s\n' "$table" "$source_count" "$dev_count" "$fit_count"
done

echo "SCHEMA_DIFF source_vs_dev"
diff -u \
  <(sqlite3 "$source_database" "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name;") \
  <(sqlite3 "$dev_database" "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name;") || true
echo "SCHEMA_DIFF source_vs_fit"
diff -u \
  <(sqlite3 "$source_database" "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name;") \
  <(sqlite3 "$fit_database" "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name;") || true
echo "ROLLBACK backups=$backup_directory"
