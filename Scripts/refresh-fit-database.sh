#!/usr/bin/env bash
set -euo pipefail

source_database="${1:-}"
fit_database="${2:-}"
backup_directory="${3:-}"

if [[ -z "$source_database" || -z "$fit_database" || -z "$backup_directory" ]]; then
  echo "Usage: $0 SOURCE_DATABASE FIT_DATABASE BACKUP_DIRECTORY" >&2
  exit 64
fi

if [[ ! -f "$source_database" ]]; then
  echo "Source database does not exist: $source_database" >&2
  exit 66
fi

source_absolute="$(cd "$(dirname "$source_database")" && pwd)/$(basename "$source_database")"
fit_absolute="$(cd "$(dirname "$fit_database")" && pwd)/$(basename "$fit_database")"
if [[ "$source_absolute" == "$fit_absolute" ]]; then
  echo "Source and FIT database must be different files." >&2
  exit 65
fi

if [[ "$(basename "$fit_database")" != "GemLife_DB_fit.sqlite" ]]; then
  echo "Refusing to write a target that is not named GemLife_DB_fit.sqlite." >&2
  exit 65
fi

mkdir -p "$backup_directory" "$(dirname "$fit_database")"
timestamp="$(date +%Y%m%d-%H%M%S)"
temporary_database="${fit_database}.tmp-${timestamp}"

if [[ -f "$fit_database" ]]; then
  cp -p "$fit_database" "$backup_directory/GemLife_DB_fit-before-refresh-${timestamp}.sqlite"
fi

cp -p "$source_database" "$temporary_database"
mv "$temporary_database" "$fit_database"
echo "FIT database refreshed from the approved source copy."
echo "FIT backup retained in: $backup_directory"
