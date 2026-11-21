#!/usr/bin/env bash
# Cut a portfolio site release: bump package.json, commit, annotated tag.
# Usage:
#   ./scripts/release.sh 1.0.1
#   ./scripts/release.sh 1.1.0 --push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

VERSION_RAW="${1:-}"
PUSH=0
if [[ "${2:-}" == "--push" || "${1:-}" == "--push" ]]; then
  PUSH=1
  if [[ "${1:-}" == "--push" ]]; then
    VERSION_RAW="${2:-}"
  fi
fi

if [[ -z "${VERSION_RAW}" ]]; then
  echo "Usage: $0 <major.minor.patch> [--push]" >&2
  exit 1
fi

VERSION="${VERSION_RAW#v}"
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must look like 1.2.3 (got: ${VERSION_RAW})" >&2
  exit 1
fi

TAG="v${VERSION}"

if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash before releasing." >&2
  exit 1
fi

node -e "
const fs=require('fs');
const p='package.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.version=process.argv[1];
fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
" "${VERSION}"

git add package.json
git commit -m "chore(release): ${TAG}"
git tag -a "${TAG}" -m "Portfolio site ${TAG}"

echo "Created commit + tag ${TAG}"
if [[ "${PUSH}" -eq 1 ]]; then
  git push origin HEAD
  git push origin "${TAG}"
  echo "Pushed HEAD and ${TAG}. GitHub Release workflow should run."
else
  echo "Next: git push origin HEAD && git push origin ${TAG}"
fi
