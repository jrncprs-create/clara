#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
for f in app.js index.html; do
  if grep -nE 'Doe nu|Parkeer' "$f" 2>/dev/null; then
    echo "FAIL: user-facing Doe nu/Parkeer in $f" >&2
    fail=1
  fi
done
if grep -nF 'Lab state' index.html 2>/dev/null; then
  echo "FAIL: Lab state tag in index.html" >&2
  fail=1
fi
exit "$fail"
