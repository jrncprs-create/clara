#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
for f in app.js index.html; do
  if grep -nE 'Doe nu|Parkeer|Open laten' "$f" 2>/dev/null; then
    echo "FAIL: user-facing Doe nu/Parkeer/Open laten in $f" >&2
    fail=1
  fi
done
if grep -nE 'Lab state|Lab State' index.html 2>/dev/null; then
  echo "FAIL: Lab state tag in index.html" >&2
  fail=1
fi
if grep -nF 'één concrete eerstvolgende stap kiezen' index.html 2>/dev/null; then
  echo "FAIL: banned generic suggestion text in index.html" >&2
  fail=1
fi
exit "$fail"
