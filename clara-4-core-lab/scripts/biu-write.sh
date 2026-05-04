#!/usr/bin/env bash
set -euo pipefail

extra_args=("--write" "$@")
dry_run=0
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    dry_run=1
  fi
done

asked_secret=0
if [[ "$dry_run" == "0" && -z "${ACE_ACTION_SECRET:-}" ]]; then
  printf "ACE_ACTION_SECRET: " >&2
  if [[ -r /dev/tty ]]; then
    IFS= read -r -s ACE_ACTION_SECRET </dev/tty
  else
    IFS= read -r -s ACE_ACTION_SECRET
  fi
  printf "\n" >&2
  asked_secret=1
fi

if [[ "$dry_run" == "0" && -z "${ACE_ACTION_SECRET:-}" ]]; then
  unset ACE_ACTION_SECRET
  echo "Fout: secret leeg. Request niet verstuurd." >&2
  exit 1
fi

if [[ "$dry_run" == "1" ]]; then
  response="$(node "$(dirname "$0")/biu-run.mjs" "${extra_args[@]}")"
else
  response="$(ACE_ACTION_SECRET="$ACE_ACTION_SECRET" node "$(dirname "$0")/biu-run.mjs" "${extra_args[@]}")"
fi

if [[ "$asked_secret" == "1" ]]; then unset ACE_ACTION_SECRET; fi

if printf "%s" "$response" | grep -q '"error"[[:space:]]*:[[:space:]]*"Unauthorized"'; then
  echo "Unauthorized: secret niet correct of niet meegegeven." >&2
fi

if command -v jq >/dev/null 2>&1; then
  printf "%s\n" "$response" | jq
else
  printf "%s\n" "$response"
fi
