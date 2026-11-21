#!/usr/bin/env bash
# Fast local pre-commit gate: secrets → typecheck → Firestore rules (if staged).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

echo "==> Gitleaks (staged)"
GITLEAKS_BIN="$("${ROOT}/scripts/ensure-gitleaks.sh")"
"${GITLEAKS_BIN}" protect --staged --redact --verbose --config "${ROOT}/.gitleaks.toml"

echo "==> Typecheck (tsc)"
npm run lint --silent

if git diff --cached --name-only --diff-filter=ACMR | grep -qE '\.rules$'; then
  echo "==> Firestore rules lint"
  npm run lint:rules --silent
else
  echo "==> Firestore rules lint (skipped — no *.rules staged)"
fi

echo "Pre-commit checks passed."
