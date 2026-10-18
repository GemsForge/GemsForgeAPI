#!/usr/bin/env bash

# Start the Vapor API and native Gem Life host as one local development session.
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load values from the ignored local .env without replacing explicit exports.
if [[ -f "$repository_root/.env" ]]; then
  while IFS='=' read -r key value; do
    key="${key#export }"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!key+x}" ]] && continue
    value="${value%$'\r'}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$repository_root/.env"
fi

if [[ -z "${DATABASE_PATH:-}" ]]; then
  echo "DATABASE_PATH is required. Export it before starting Gem Life." >&2
  exit 1
fi

api_host="127.0.0.1"
api_port="8081"
if [[ -n "${API_HOST+x}" ]]; then api_host="$API_HOST"; fi
if [[ -n "${API_PORT+x}" ]]; then api_port="$API_PORT"; fi
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

echo "Starting GemsForgeAPI on http://${api_host}:${api_port}…"
cd "$repository_root"
if [[ "${GEM_LIFE_PRODUCTION:-0}" == "1" ]]; then
  binary_directory="$(swift build -c release --show-bin-path)"
  export GEM_LIFE_ASSETS_DIRECTORY="${binary_directory}/GemsForgeAPI_GemLifeHost.bundle/Contents/Resources/Console"
  if [[ ! -f "${GEM_LIFE_ASSETS_DIRECTORY}/index.html" ]]; then
    export GEM_LIFE_ASSETS_DIRECTORY="${binary_directory}/GemsForgeAPI_GemLifeHost.bundle/Console"
  fi
  export GEM_LIFE_CONSOLE_URL="http://127.0.0.1:${api_port}/app/"
  if [[ ! -f "${GEM_LIFE_ASSETS_DIRECTORY}/index.html" || ! -x "${binary_directory}/GemsForgeAPI" || ! -x "${binary_directory}/GemLifeHost" ]]; then
    echo "Production build missing. Run node Scripts/build-gem-life.mjs first." >&2
    exit 1
  fi
  "${binary_directory}/GemsForgeAPI" serve --hostname "127.0.0.1" --port "${api_port}" &
else
  swift run GemsForgeAPI serve --hostname "${api_host}" --port "${api_port}" &
fi
api_pid=$!

if [[ "${GEM_LIFE_PRODUCTION:-0}" == "1" ]]; then
  api_ready=0
  for attempt in {1..100}; do
    if ! kill -0 "$api_pid" 2>/dev/null; then break; fi
    if curl --silent --fail --max-time 1 "http://127.0.0.1:${api_port}/health" >/dev/null; then api_ready=1; break; fi
    sleep 0.2
  done
  if [[ "$api_ready" != "1" ]]; then echo "The local API did not become ready." >&2; exit 1; fi
fi

echo "Starting GemLifeHost…"
echo "Stop both executables with Ctrl-C."
if [[ "${GEM_LIFE_PRODUCTION:-0}" == "1" ]]; then
  "${binary_directory}/GemLifeHost"
else
  swift run GemLifeHost
fi
