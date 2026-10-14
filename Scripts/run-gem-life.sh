#!/usr/bin/env bash

# Start the Vapor API and native Gem Life host as one local development session.
set -Eeuo pipefail

if [[ -z "${DATABASE_PATH:-}" ]]; then
  echo "DATABASE_PATH is required. Export it before starting Gem Life." >&2
  exit 1
fi

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8080}"
api_pid=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    echo "Stopping GemsForgeAPI (pid $api_pid)…"
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

echo "Starting GemsForgeAPI on http://$API_HOST:$API_PORT…"
swift run GemsForgeAPI serve --hostname "$API_HOST" --port "$API_PORT" &
api_pid=$!

echo "Starting GemLifeHost…"
echo "Stop both executables with Ctrl-C."
swift run GemLifeHost
