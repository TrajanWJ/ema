#!/usr/bin/env bash
# EMA Smoke Tests — run after every deploy
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Default: http://localhost:4488

set -euo pipefail

BASE="${1:-http://localhost:4488}"
PASS=0
FAIL=0

green() { printf '\033[0;32m✅ %s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m❌ %s\033[0m\n' "$*"; }

check() {
  local name="$1"
  local result="$2"
  local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    green "$name"
    PASS=$((PASS + 1))
  else
    red "$name — expected '$expected', got: $(echo "$result" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

check_status() {
  local name="$1"
  local code="$2"
  local expected="$3"
  if [[ "$code" == "$expected" ]]; then
    green "$name (HTTP $code)"
    PASS=$((PASS + 1))
  else
    red "$name — expected HTTP $expected, got $code"
    FAIL=$((FAIL + 1))
  fi
}

echo "🔎 EMA Smoke Tests → $BASE"
echo "---"

# VM health check (always-on monitor)
R=$(curl -sf "$BASE/api/vm/health" 2>&1 || echo "CURL_ERROR")
check "VM health endpoint responds" "$R" '"status"'

# Dashboard
R=$(curl -sf "$BASE/api/dashboard/today" 2>&1 || echo "CURL_ERROR")
check "Dashboard today endpoint responds" "$R" '{'

# Brain dump list
R=$(curl -sf "$BASE/api/brain-dump/items" 2>&1 || echo "CURL_ERROR")
check "Brain dump list returns data" "$R" '"items"\|"data"\|\[\]'

# Tasks list
R=$(curl -sf "$BASE/api/tasks" 2>&1 || echo "CURL_ERROR")
check "Tasks list responds" "$R" '{'

# Projects list
R=$(curl -sf "$BASE/api/projects" 2>&1 || echo "CURL_ERROR")
check "Projects list responds" "$R" '{'

# Create + read + delete cycle (brain dump)
STAMP=$(date +%s)
R=$(curl -sf -X POST "$BASE/api/brain-dump/items" \
  -H 'Content-Type: application/json' \
  -d "{\"content\":\"smoke-test-$STAMP\"}" 2>&1 || echo "CURL_ERROR")
check "Can create brain dump item" "$R" '"id"'

ITEM_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
if [[ -n "$ITEM_ID" && "$ITEM_ID" != "CURL_ERROR" ]]; then
  # Cleanup — process the item to remove it from the queue
  D=$(curl -sf -X PATCH "$BASE/api/brain-dump/items/$ITEM_ID/process" \
    -H 'Content-Type: application/json' \
    -d '{"action":"archive"}' 2>&1 || echo "CURL_ERROR")
  check "Can process created brain dump item" "$D" '"processed"\|"ok"\|"id"'
fi

# WebSocket endpoint reachable
CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE/socket/websocket?vsn=2.0.0" 2>&1 || echo "000")
check "WebSocket endpoint reachable" "$CODE" "400\|101\|200\|426"

echo "---"
echo "Results: $PASS passed, $FAIL failed"
if [[ $FAIL -eq 0 ]]; then
  echo "✅ All smoke tests passed"
  exit 0
else
  echo "❌ $FAIL smoke test(s) failed"
  exit 1
fi
