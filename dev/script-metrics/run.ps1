<#
.SYNOPSIS
  Build and run the script-metrics pipeline in Docker.

.DESCRIPTION
  Nothing is installed on the host: the image carries Python, curl, lbzip2 and
  sqlite3, the ~15 GB dump cache lives in a Docker named volume, and only
  out/ crosses back to the host.

.EXAMPLE
  .\run.ps1                       # full run against the latest dump
  .\run.ps1 -ReportOnly           # re-render reports from the existing database
  .\run.ps1 -DumpId 20260905-002519
  .\run.ps1 -Clean                # drop the cached dumps (frees ~15 GB)
#>
[CmdletBinding()]
param(
    [switch] $ReportOnly,
    [string] $DumpId,
    [switch] $Clean,
    [switch] $NoBuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if ($Clean) {
    Write-Host 'Removing the cached dump volume...' -ForegroundColor Yellow
    docker compose down -v
    Write-Host 'Done. The next run will re-download.' -ForegroundColor Green
    return
}

if (-not $NoBuild) {
    docker compose build | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "docker compose build failed ($LASTEXITCODE)" }
}

$pipelineArgs = @('--data-dir', '/data', '--out', '/out')
if ($ReportOnly) { $pipelineArgs += '--report-only' }
if ($DumpId)     { $pipelineArgs += @('--dump-id', $DumpId) }

Write-Host "Running: $($pipelineArgs -join ' ')" -ForegroundColor Cyan
docker compose run --rm metrics @pipelineArgs
if ($LASTEXITCODE -ne 0) { throw "pipeline failed ($LASTEXITCODE)" }

Write-Host ''
Write-Host 'Reports written to out/:' -ForegroundColor Green
Get-ChildItem -Path (Join-Path $PSScriptRoot 'out') -File |
    Where-Object { $_.Name -ne 'metrics.db' } |
    ForEach-Object { '  {0,-18} {1,8:N0} KB' -f $_.Name, ($_.Length / 1KB) }
