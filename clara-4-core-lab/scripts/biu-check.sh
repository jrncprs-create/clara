#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="https://clara-4-core-lab.vercel.app/api/ace"
DEFAULT_INPUT='BIU extract uit ChatGPT-gesprek:
Project Clara Core Lab / ACE:
- ACE v0.14.21 werkt end-to-end in production.
- GitHub write via PROJECTBRAIN_GITHUB_TOKEN werkt.
- Routingprioriteit is gefixt zodat LaLampe zwaarder weegt dan systeemwoord ACE.
- Beslissing: systeem heet ACE, methode heet BIU.
- Volgende stap: BIU-laag bovenop ACE bouwen.

Project LaLampe:
- Er is echte rijke LaLampe-context tijdelijk veilig buiten de repo bewaard.
- Later bewust vergelijken met projectbrain/projects/lalampe.md en raw/lalampe.md.'

if [[ -n "${BIU_INPUT:-}" ]]; then
  input="$BIU_INPUT"
else
  echo "Plak BIU-input en sluit af met Ctrl-D. Druk direct Ctrl-D voor standaard testpayload:" >&2
  input="$(cat || true)"
  if [[ -z "${input//[[:space:]]/}" ]]; then
    input="$DEFAULT_INPUT"
  fi
fi

asked_secret=0
if [[ -z "${ACE_ACTION_SECRET:-}" ]]; then
  printf "ACE_ACTION_SECRET: " >&2
  IFS= read -r -s ACE_ACTION_SECRET
  printf "\n" >&2
  asked_secret=1
fi

if [[ -z "${ACE_ACTION_SECRET:-}" ]]; then
  unset ACE_ACTION_SECRET
  echo "Fout: secret leeg. Request niet verstuurd." >&2
  exit 1
fi

payload="$(node -e 'const input=process.argv[1]; console.log(JSON.stringify({ input, source: "biu", mode: "check" }));' "$input")"

echo "BIU check request gestart..." >&2
response="$(
  curl -sS --max-time 20 \
    -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-ACE-SECRET: ${ACE_ACTION_SECRET}" \
    -d "$payload"
)"
if [[ "$asked_secret" == "1" ]]; then unset ACE_ACTION_SECRET; fi

echo "BIU response ontvangen." >&2
if printf "%s" "$response" | grep -q '"error"[[:space:]]*:[[:space:]]*"Unauthorized"'; then
  echo "Unauthorized: secret niet correct of niet meegegeven." >&2
fi

if command -v jq >/dev/null 2>&1; then
  printf "%s\n" "$response" | jq
else
  printf "%s\n" "$response"
fi
