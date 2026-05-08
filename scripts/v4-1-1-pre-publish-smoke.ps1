# v4-1-1-pre-publish-smoke.ps1 — Pre-publish smoke gate for v4.1.1
# Runs typecheck + build + test + version-parity check across all 3 packages.
# Mirrors the CI workflow's verify step; useful as a local smoke before tagging.
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot
Write-Host "==> Repo root: $RepoRoot"

Write-Host "==> Reading package versions..."
$KSL = (Get-Content "packages/kadena-stoic-legacy/package.json" | ConvertFrom-Json).version
$Stoa = (Get-Content "packages/stoa-core/package.json" | ConvertFrom-Json).version
$Our = (Get-Content "packages/ouronet-core/package.json" | ConvertFrom-Json).version
Write-Host "  kadena-stoic-legacy: $KSL"
Write-Host "  stoa-core:           $Stoa"
Write-Host "  ouronet-core:        $Our"

if ($KSL -ne $Stoa -or $KSL -ne $Our) {
  Write-Error "Atomic-triplet invariant violated — package versions diverge"
  exit 1
}
Write-Host "  [OK] Atomic-triplet invariant: all 3 packages at $KSL"

Write-Host "==> Step 1: typecheck (all 3 packages)..."
& npx tsc --noEmit -p packages/kadena-stoic-legacy/tsconfig.json; if ($LASTEXITCODE -ne 0) { exit 1 }
& npx tsc --noEmit -p packages/stoa-core/tsconfig.json; if ($LASTEXITCODE -ne 0) { exit 1 }
& npx tsc --noEmit -p packages/ouronet-core/tsconfig.json; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "  [OK] Typecheck passed across all 3 packages"

Write-Host "==> Step 2: build (all 3 packages, in dependency order)..."
& npm run build --workspace=packages/kadena-stoic-legacy; if ($LASTEXITCODE -ne 0) { exit 1 }
& npm run build --workspace=packages/stoa-core; if ($LASTEXITCODE -ne 0) { exit 1 }
& npm run build --workspace=packages/ouronet-core; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "  [OK] Build succeeded for all 3 packages"

Write-Host "==> Step 3: test (all 3 packages)..."
& npm test --workspaces --if-present; if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "  [OK] Tests passed for all 3 packages"

Write-Host ""
Write-Host "==> Pre-publish smoke gate: ALL CLEAR for $KSL"
