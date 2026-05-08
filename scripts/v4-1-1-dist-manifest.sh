#!/usr/bin/env bash
# v4-1-1-dist-manifest.sh — Generate SHA256 manifest of dist/ contents for supply-chain audit.
# Writes dist/MANIFEST.sha256 in each package. Excludes the manifest file itself.
# Run after 'npm run build' across all packages.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

for PKG in kadena-stoic-legacy stoa-core ouronet-core; do
  if [ ! -d "packages/$PKG/dist" ]; then
    echo "  WARN: dist/ missing for $PKG — skipping"
    continue
  fi
  echo "==> Generating MANIFEST.sha256 for $PKG..."
  cd "packages/$PKG/dist"
  find . -type f -not -name 'MANIFEST.sha256' -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sort > MANIFEST.sha256
  ENTRY_COUNT=$(wc -l < MANIFEST.sha256)
  echo "  Wrote $ENTRY_COUNT entries to packages/$PKG/dist/MANIFEST.sha256"
  cd "$REPO_ROOT"
done

echo "==> Manifests generated."
