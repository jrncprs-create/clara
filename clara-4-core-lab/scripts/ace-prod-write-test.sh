#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="https://clara-4-core-lab.vercel.app/api/ace"
PAYLOAD='{"input":"ACE test: LaLampe workshopflow simpeler maken. Dit is een veilige eerste write-test vanuit production.","source":"chatgpt","mode":"write"}'

printf "ACE_ACTION_SECRET: " >&2
IFS= read -r -s ACE_SECRET
printf "\n" >&2

if [[ -z "${ACE_SECRET}" ]]; then
  unset ACE_SECRET
  echo "Fout: secret leeg. Request niet verstuurd." >&2
  exit 1
fi

echo "ACE production write-test request gestart..." >&2
response="$(
  curl -sS --max-time 20 \
    -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-ACE-SECRET: ${ACE_SECRET}" \
    -d "$PAYLOAD"
)"
unset ACE_SECRET

echo "ACE response ontvangen." >&2
if printf "%s" "$response" | grep -q '"error"[[:space:]]*:[[:space:]]*"Unauthorized"'; then
  echo "Unauthorized: secret niet correct of niet meegegeven." >&2
fi

if command -v jq >/dev/null 2>&1; then
  printf "%s\n" "$response" | jq
else
  printf "%s\n" "$response"
fi
