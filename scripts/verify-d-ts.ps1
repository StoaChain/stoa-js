# verify-d-ts.ps1 — Verify .d.ts files exist in each package's dist/ after build.
# A non-zero .d.ts count confirms the TypeScript emit produced declaration files.
# Run after 'npm run build' across all packages.
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$Fail = $false

foreach ($Pkg in @("kadena-stoic-legacy", "stoa-core", "ouronet-core")) {
  Write-Host "==> Verifying .d.ts for $Pkg..."
  $DistPath = "packages/$Pkg/dist"
  if (-not (Test-Path $DistPath)) {
    Write-Warning "  dist/ missing for $Pkg — run 'npm run build' first"
    $Fail = $true
    continue
  }
  $DtsFiles = Get-ChildItem -Path $DistPath -Recurse -Include "*.d.ts", "*.d.cts" -File
  Write-Host "  Found $($DtsFiles.Count) .d.ts/.d.cts files"
  if ($DtsFiles.Count -eq 0) {
    Write-Host "  ERROR: no .d.ts files found for $Pkg"
    $Fail = $true
  }
}

if ($Fail) {
  Write-Error "verify-d-ts failed — see above"
  exit 1
}

Write-Host "==> verify-d-ts: ALL CLEAR"
