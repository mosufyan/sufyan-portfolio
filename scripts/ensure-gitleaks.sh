#!/usr/bin/env bash
# Download a pinned gitleaks binary into .tools/ if not already present / on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS_DIR="${ROOT}/.tools"
VERSION="8.30.1"
BIN="${TOOLS_DIR}/gitleaks"

if command -v gitleaks >/dev/null 2>&1; then
  command -v gitleaks
  exit 0
fi

if [[ -x "${BIN}" ]]; then
  echo "${BIN}"
  exit 0
fi

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "${os}-${arch}" in
  darwin-arm64) asset="gitleaks_${VERSION}_darwin_arm64.tar.gz" ;;
  darwin-x86_64) asset="gitleaks_${VERSION}_darwin_x64.tar.gz" ;;
  linux-x86_64|linux-amd64) asset="gitleaks_${VERSION}_linux_x64.tar.gz" ;;
  linux-aarch64|linux-arm64) asset="gitleaks_${VERSION}_linux_arm64.tar.gz" ;;
  *)
    echo "Unsupported platform for auto-install: ${os}-${arch}" >&2
    echo "Install gitleaks manually: https://github.com/gitleaks/gitleaks" >&2
    exit 1
    ;;
esac

mkdir -p "${TOOLS_DIR}"
tmp="$(mktemp -d)"
url="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${asset}"
echo "Downloading gitleaks v${VERSION} (${asset})..." >&2
curl -sSfL "${url}" -o "${tmp}/${asset}"
tar -xzf "${tmp}/${asset}" -C "${tmp}" gitleaks
mv "${tmp}/gitleaks" "${BIN}"
chmod +x "${BIN}"
rm -rf "${tmp}"
echo "${BIN}"
