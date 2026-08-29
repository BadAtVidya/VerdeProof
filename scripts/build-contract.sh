#!/usr/bin/env bash
set -euo pipefail

compact_version="${COMPACT_VERSION:-0.31.1}"
compact_installer_version="0.5.2"

if ! command -v compact >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -LsSf \
    "https://github.com/midnightntwrk/compact/releases/download/compact-v${compact_installer_version}/compact-installer.sh" \
    | sh -s -- --quiet
fi

export PATH="$HOME/.local/bin:$PATH"
compact update "$compact_version"
npm --prefix contracts run compact
