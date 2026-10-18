#!/usr/bin/env bash

# Load ignored local settings and run the offline, dev-only database bootstrap.
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$repository_root/.env" ]]; then
  while IFS='=' read -r key value; do
    key="${key#export }"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!key+x}" ]] && continue
    value="${value%$'\r'}"
    if [[ "$value" == \"* && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'* && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$repository_root/.env"
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: Scripts/bootstrap-legacy-database.sh <exact-database-filename>" >&2
  exit 2
fi

cd "$repository_root"
exec swift run GemsForgeAPI bootstrap-legacy-database \
  --confirm-database-filename "$1"
