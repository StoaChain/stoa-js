#!/usr/bin/env bash
# verify-d-ts.sh — Verify .d.ts files exist in each package's dist/ after build.
# A non-zero .d.ts count confirms the TypeScript emit produced declaration files.
# Run after 'npm run build' across all packages.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0

for PKG in kadena-stoic-legacy stoa-core ouronet-core; do
  echo "==> Verifying .d.ts for $PKG..."
  if [ ! -d "packages/$PKG/dist" ]; then
    echo "  WARN: dist/ missing for $PKG — run 'npm run build' first"
    FAIL=1
    continue
  fi
  DTS_COUNT=$(find "packages/$PKG/dist" -type f \( -name "*.d.ts" -o -name "*.d.cts" \) | wc -l)
  echo "  Found $DTS_COUNT .d.ts/.d.cts files"
  if [ "$DTS_COUNT" -eq 0 ]; then
    echo "  ERROR: no .d.ts files found for $PKG"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "ERROR: verify-d-ts failed — see above"
  exit 1
fi

echo "==> verify-d-ts: ALL CLEAR"
