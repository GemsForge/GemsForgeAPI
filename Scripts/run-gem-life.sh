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
if [[ -n "${API_HOST+x}" ]]; then api_host="$API_HOST"; fi
requested_api_port="${API_PORT:-}"
api_port=""
api_port_file="$repository_root/.build/gemlife-api-port"
temp_root="${TMPDIR:-/tmp}"
port_lock_dir="${temp_root%/}/gemlife-api-port-allocation.lock"
port_lock_owned=0
api_pid=""

acquire_port_lock() {
  local attempt
  for attempt in {1..600}; do
    if mkdir "$port_lock_dir" 2>/dev/null; then
      port_lock_owned=1
      printf '%s\n' "$$" > "$port_lock_dir/pid"
      return 0
    fi
    if [[ -f "$port_lock_dir/pid" ]]; then
      local lock_pid
      lock_pid="$(<"$port_lock_dir/pid")"
      if [[ "$lock_pid" =~ ^[1-9][0-9]*$ ]] && ! kill -0 "$lock_pid" 2>/dev/null; then
        rm -f "$port_lock_dir/pid"
        rmdir "$port_lock_dir" 2>/dev/null || true
      fi
    fi
    sleep 0.1
  done
  echo "Timed out waiting for another local Gem Life API to claim its port." >&2
  return 1
}

release_port_lock() {
  if [[ "$port_lock_owned" == "1" ]]; then
    if [[ -f "$port_lock_dir/pid" && "$(<"$port_lock_dir/pid")" == "$$" ]]; then
      rm -f "$port_lock_dir/pid"
    fi
    rmdir "$port_lock_dir" 2>/dev/null || true
    port_lock_owned=0
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    echo "Stopping GemsForgeAPI (pid $api_pid)…"
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi

  if [[ -n "$api_port" && -f "$api_port_file" && "$(<"$api_port_file")" == "$api_port" ]]; then
    rm -f "$api_port_file"
  fi
  release_port_lock

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

acquire_port_lock
api_port="$(node "$repository_root/Scripts/select-api-port.mjs" "$api_host" "$requested_api_port")"
mkdir -p "$(dirname "$api_port_file")"
printf '%s\n' "$api_port" > "$api_port_file"
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

api_ready=0
for attempt in {1..100}; do
  if ! kill -0 "$api_pid" 2>/dev/null; then break; fi
  if curl --silent --output /dev/null --max-time 1 "http://127.0.0.1:${api_port}/health"; then api_ready=1; break; fi
  sleep 0.1
done
if [[ "$api_ready" != "1" ]]; then
  echo "The local API did not start listening on port ${api_port}. Check the API output above." >&2
  exit 1
fi
release_port_lock

echo "Starting GemLifeHost…"
echo "Stop both executables with Ctrl-C."
if [[ "${GEM_LIFE_PRODUCTION:-0}" == "1" ]]; then
  "${binary_directory}/GemLifeHost"
else
  swift run GemLifeHost
fi
