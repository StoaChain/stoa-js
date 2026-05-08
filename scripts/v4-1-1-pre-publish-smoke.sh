#!/usr/bin/env bash
# v4-1-1-pre-publish-smoke.sh — Pre-publish smoke gate for v4.1.1
# Runs typecheck + build + test + version-parity check across all 3 packages.
# Mirrors the CI workflow's verify step; useful as a local smoke before tagging.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Repo root: $REPO_ROOT"

echo "==> Reading package versions..."
KSL_VERSION=$(node -p "require('./packages/kadena-stoic-legacy/package.json').version")
STOA_VERSION=$(node -p "require('./packages/stoa-core/package.json').version")
OUR_VERSION=$(node -p "require('./packages/ouronet-core/package.json').version")
echo "  kadena-stoic-legacy: $KSL_VERSION"
echo "  stoa-core:           $STOA_VERSION"
echo "  ouronet-core:        $OUR_VERSION"

if [ "$KSL_VERSION" != "$STOA_VERSION" ] || [ "$KSL_VERSION" != "$OUR_VERSION" ]; then
  echo "ERROR: Atomic-triplet invariant violated — package versions diverge"
  exit 1
fi
echo "  ✓ Atomic-triplet invariant: all 3 packages at $KSL_VERSION"

echo "==> Step 1: typecheck (all 3 packages)..."
npx tsc --noEmit -p packages/kadena-stoic-legacy/tsconfig.json
npx tsc --noEmit -p packages/stoa-core/tsconfig.json
npx tsc --noEmit -p packages/ouronet-core/tsconfig.json
echo "  ✓ Typecheck passed across all 3 packages"

echo "==> Step 2: build (all 3 packages, in dependency order)..."
npm run build --workspace=packages/kadena-stoic-legacy
npm run build --workspace=packages/stoa-core
npm run build --workspace=packages/ouronet-core
echo "  ✓ Build succeeded for all 3 packages"

echo "==> Step 3: test (all 3 packages)..."
npm test --workspaces --if-present
echo "  ✓ Tests passed for all 3 packages"

echo ""
echo "==> Pre-publish smoke gate: ALL CLEAR for $KSL_VERSION"
