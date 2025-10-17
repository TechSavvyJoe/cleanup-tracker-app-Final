#!/usr/bin/env zsh
# Run a local CI-like sequence:
# - client lint, build, tests
# - start server, wait for /api/health
# - login (seeded PIN) and run authenticated diag-check
# - run npm audit (non-fatal)
# - stop server
# Run from repository root: ./scripts/run-local-ci.sh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "=== Client: lint ==="
npm --prefix client run lint

echo "=== Client: build ==="
npm --prefix client run build

echo "=== Client: tests ==="
CI=true npm --prefix client test -- --watchAll=false

echo "=== Client: audit (non-fatal) ==="
npm --prefix client audit --audit-level=moderate || true

echo "=== Server: start ==="
export PORT=5051
export NODE_ENV=test
nohup npm --prefix server start > server/server.log 2>&1 &
echo $! > server/server.pid
sleep 1

# wait for health
MAX=40
COUNT=0
while ! curl -sSf "http://localhost:5051/api/health" >/dev/null 2>&1; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX ]; then
    echo "Server did not become healthy in time. Dumping server log..."
    sed -n '1,240p' server/server.log || true
    kill "$(cat server/server.pid)" || true
    rm -f server/server.pid
    exit 2
  fi
  echo "Waiting for server... ($COUNT)"
  sleep 1
done
echo "Server is healthy"

echo "=== Server: login to obtain token ==="
# Allow overriding the test PIN via TEST_USER_PIN env var (useful for CI secrets); default to 1701 for local runs.
PIN=${TEST_USER_PIN:-1701}
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"pin\":\"$PIN\"}" "http://localhost:5051/api/v2/auth/login" || true)
echo "login response head: ${RESP:0:200}"
TOKEN=$(echo "$RESP" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(s);if(j.tokens&&j.tokens.accessToken)console.log(j.tokens.accessToken);}catch(e){} })')
if [ -z "$TOKEN" ]; then
  echo "Failed to obtain access token; dumping server log"
  sed -n '1,240p' server/server.log || true
  kill "$(cat server/server.pid)" || true
  rm -f server/server.pid
  exit 3
fi
echo "Obtained token (truncated): ${TOKEN:0:8}..."

echo "=== Running diag-check ==="
node scripts/diag-check.js "http://localhost:5051" "$TOKEN"

echo "=== Server: audit (non-fatal) ==="
npm --prefix server audit --audit-level=moderate || true

echo "=== Stopping server ==="
if [ -f server/server.pid ]; then
  kill "$(cat server/server.pid)" || true
  rm -f server/server.pid
fi

echo "=== Local CI run completed successfully ==="
