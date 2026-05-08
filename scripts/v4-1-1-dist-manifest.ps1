# v4-1-1-dist-manifest.ps1 — Generate SHA256 manifest of dist/ contents for supply-chain audit.
# Writes dist/MANIFEST.sha256 in each package. Excludes the manifest file itself.
# Run after 'npm run build' across all packages.
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

foreach ($Pkg in @("kadena-stoic-legacy", "stoa-core", "ouronet-core")) {
  $DistPath = Join-Path $RepoRoot "packages/$Pkg/dist"
  if (-not (Test-Path $DistPath)) {
    Write-Warning "  dist/ missing for $Pkg — skipping"
    continue
  }
  Write-Host "==> Generating MANIFEST.sha256 for $Pkg..."

  $Files = Get-ChildItem -Path $DistPath -Recurse -File |
    Where-Object { $_.Name -ne "MANIFEST.sha256" }

  $Manifest = @()
  foreach ($F in $Files) {
    $Hash = (Get-FileHash -Algorithm SHA256 -Path $F.FullName).Hash.ToLower()
    # Produce a path relative to dist/ with forward slashes, matching sha256sum output style
    $Rel = $F.FullName.Substring($DistPath.Length).TrimStart('\', '/').Replace('\', '/')
    $Manifest += "$Hash  $Rel"
  }

  $ManifestPath = Join-Path $DistPath "MANIFEST.sha256"
  $Manifest | Sort-Object | Out-File -FilePath $ManifestPath -Encoding ascii
  Write-Host "  Wrote $($Manifest.Count) entries to packages/$Pkg/dist/MANIFEST.sha256"
}

Write-Host "==> Manifests generated."
