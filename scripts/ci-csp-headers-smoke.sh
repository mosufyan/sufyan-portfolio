#!/usr/bin/env bash
# Start production server briefly and assert security headers on GET /.
set -euo pipefail

PORT="${CSP_SMOKE_PORT:-3017}"
BASE="http://127.0.0.1:${PORT}"
SESSION_SECRET="${SESSION_SECRET:-ci-csp-smoke-session-secret-32chars}"
export SESSION_SECRET NODE_ENV=production PORT

if [[ ! -d dist ]]; then
  echo "::error::dist/ missing — run production build first"
  exit 1
fi

npm start > /tmp/csp-smoke-server.log 2>&1 &
PID=$!
cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
  if curl -sf "$BASE/api/uptime" >/dev/null; then
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "::error::server exited before becoming ready"
    cat /tmp/csp-smoke-server.log || true
    exit 1
  fi
  sleep 1
  if [[ "$i" -eq 60 ]]; then
    echo "::error::server did not become ready"
    cat /tmp/csp-smoke-server.log || true
    exit 1
  fi
done

HEADERS="$(curl -sI "$BASE/")"
printf '%s\n' "$HEADERS"

assert_header() {
  local name="$1"
  local needle="$2"
  if ! printf '%s' "$HEADERS" | grep -i "^${name}:" | grep -Fqi "$needle"; then
    echo "::error::Expected ${name} to contain: ${needle}"
    exit 1
  fi
}

assert_header "Content-Security-Policy" "wss://api.x.ai"
assert_header "Content-Security-Policy" "media-src"
assert_header "Content-Security-Policy" "default-src 'self'"
assert_header "X-Content-Type-Options" "nosniff"
assert_header "Referrer-Policy" "strict-origin-when-cross-origin"
assert_header "Permissions-Policy" "microphone=(self)"

echo "OK: CSP / security headers smoke passed"
