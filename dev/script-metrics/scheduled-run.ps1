<#
.SYNOPSIS
  Unattended nightly entry point for the script-metrics pipeline.

.DESCRIPTION
  What the Task Scheduler runs. run.ps1 is still the thing to use by hand; this
  only adds what an unattended 3 a.m. run needs and a foreground one does not:

    · a log per run, so a failure that nobody watched can still be read back
    · a check that Docker is actually up — the pipeline is entirely Docker, and
      Docker Desktop does not necessarily run when nobody is logged in, which is
      the most likely way for this to fail silently
    · pinning to the dump that is CURRENT AT START, so a run that straddles a
      new export cannot half-use two of them
    · old logs pruned, since this runs twice a week forever

  It commits and pushes the four regenerated report files, and ONLY those four.
  If anything else in the working tree has changed, or the repo is not on main,
  it leaves everything alone and says so in the log — an unattended commit that
  sweeps up whatever happened to be lying around is the thing to avoid, not the
  commit itself.

.NOTES
  Scheduled: Wednesday and Saturday, 23:30 local.

  Measured across three exports, MusicBrainz's fullexport runs to a tight
  schedule:

      export id / start   00:21-00:24 UTC
      mbdump-edit.tar.bz2 04:42-04:45 UTC
      SHA256SUMS (last)   04:48-04:51 UTC   <- the completion marker

  So it finishes ~04:50 UTC, i.e. 06:50 local. 23:30 the same evening is ~17
  hours after that: complete, still night, and the dump is used the same day it
  is published.

  Not 03:00 on the export morning: at 01:00 UTC the export is 40 minutes in and
  LATEST still names the PREVIOUS dump, so a run then would rebuild from
  four-day-old data and report success. (The already-built check would in fact
  catch that and skip, but relying on a safety net for something the schedule
  can simply avoid is the wrong way round.)

  Waiting costs nothing in data freshness either way: a dump is a snapshot taken
  at ~00:21 UTC, so ingesting it at 07:00 or at 23:30 yields identical numbers.
  The only thing the timing changes is how soon the dashboard reflects it.
#>
[CmdletBinding()]
param(
    [int] $KeepLogs = 20,
    # Commit/push the reports already in out\ without re-running the pipeline.
    # Also how the commit guard is tested without burning an hour of ingest.
    [switch] $PublishOnly
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("run-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))

function Write-Log { param([string] $m) ; "$([DateTime]::Now.ToString('HH:mm:ss'))  $m" | Tee-Object -FilePath $log -Append | Write-Host }

<#
  Commit and push the regenerated reports — and nothing else.

  The four paths below are exactly what a run rewrites (docs/stats.html is the
  GitHub Pages copy, produced by the same pass). Anything else showing up dirty
  means work in progress that is not ours to commit, so the whole thing is
  skipped rather than partially staged.

  The push authenticates as the bot through a per-process credential: the PAT is
  injected via GIT_CONFIG_* and never written into .git/config, and never into
  this log.
#>
function Publish-Reports {
    param([string] $DumpId)

    $repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $expected = @(
        'dev/script-metrics/out/METRICS.md',
        'dev/script-metrics/out/dashboard.html',
        'dev/script-metrics/out/metrics.json',
        'docs/stats.html'
    )

    $branch = (& git -C $repo rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne 'main') { Write-Log "not committing — on branch '$branch', not main"; return }

    $dirty = @(& git -C $repo status --porcelain --untracked-files=no |
        ForEach-Object { ($_.Substring(3)).Trim('"').Replace('\', '/') })
    if (-not $dirty) { Write-Log 'nothing changed — reports are identical to what is committed'; return }

    $unexpected = @($dirty | Where-Object { $expected -notcontains $_ })
    if ($unexpected.Count) {
        Write-Log "NOT committing — the working tree also has: $($unexpected -join ', ')"
        Write-Log '  (reports are regenerated in out\ and left for you)'
        return
    }

    $tokenFile = Join-Path $repo 'dev\.github-credentials.json'
    if (-not (Test-Path $tokenFile)) { Write-Log "NOT pushing — $tokenFile is missing"; return }
    $token = (Get-Content -Raw $tokenFile | ConvertFrom-Json).token
    if (-not $token) { Write-Log 'NOT pushing — no token in the credentials file'; return }

    & git -C $repo add -- $expected
    & git -C $repo -c user.name='claude-ai-milic' -c user.email='claude-ai-milic@users.noreply.github.com' `
        commit -q -m "metrics: rebuild from the $DumpId snapshot"
    if ($LASTEXITCODE -ne 0) { Write-Log "commit failed ($LASTEXITCODE)"; return }
    Write-Log "committed $((& git -C $repo rev-parse --short HEAD).Trim())"

    $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("claude-ai-milic:$token"))
    $env:GIT_CONFIG_COUNT = '1'
    $env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    $env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $b64"
    try {
        & git -C $repo push github main 2>&1 | ForEach-Object { Write-Log "  git: $_" }
        if ($LASTEXITCODE -eq 0) { Write-Log 'pushed to main' } else { Write-Log "push failed ($LASTEXITCODE) — the commit is local" }
    } finally {
        Remove-Item Env:GIT_CONFIG_COUNT, Env:GIT_CONFIG_KEY_0, Env:GIT_CONFIG_VALUE_0 -ErrorAction SilentlyContinue
    }
}

Write-Log "=== scheduled script-metrics run ==="

# Docker first: without it nothing else can work, and "docker not running" is a
# far more useful line in the log than a compose error 200 lines down.
try {
    $v = & docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -ne 0) { throw "$v" }
    Write-Log "docker server $v"
} catch {
    Write-Log "ABORT: Docker is not available — $($_.Exception.Message)"
    Write-Log "  (Docker Desktop may not be running; this task needs it up.)"
    exit 1
}

# Pin the dump id now, so the run cannot straddle two exports.
try {
    # ⚠ .Content comes back as a BYTE ARRAY for this response — the server sends
    # no charset, so PowerShell does not decode it — and calling .Trim() on it
    # throws "[System.Byte] does not contain a method named 'Trim'". That would
    # have aborted every scheduled run with "could not read the LATEST dump id",
    # which is a failure nobody would see until wondering why the dashboard had
    # gone stale. Decode explicitly.
    $raw = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 `
        -Uri 'https://data.metabrainz.org/pub/musicbrainz/data/fullexport/LATEST').Content
    if ($raw -is [byte[]]) { $raw = [System.Text.Encoding]::UTF8.GetString($raw) }
    $dumpId = "$raw".Trim()
} catch {
    Write-Log "ABORT: could not read the LATEST dump id — $($_.Exception.Message)"
    exit 1
}
if ($dumpId -notmatch '^\d{8}-\d{6}$') { Write-Log "ABORT: LATEST looks wrong: '$dumpId'"; exit 1 }
Write-Log "dump $dumpId"

# Already done? The reports record which dump produced them, so a re-run over
# the same export is just I/O. Skip it and say so.
$metrics = Join-Path $PSScriptRoot 'out\metrics.json'
if (Test-Path $metrics) {
    try {
        $prev = (Get-Content -Raw $metrics | ConvertFrom-Json).dump_id
        if ($prev -eq $dumpId -and -not $PublishOnly) { Write-Log "already built from $dumpId — nothing to do"; exit 0 }
        Write-Log "previous reports were built from $prev"
    } catch { Write-Log "could not read the previous dump id ($($_.Exception.Message)) — continuing" }
}

if ($PublishOnly) {
    Write-Log 'publish only — not running the pipeline'
    Publish-Reports -DumpId $dumpId
    exit 0
}

$sw = [Diagnostics.Stopwatch]::StartNew()
& (Join-Path $PSScriptRoot 'run.ps1') -DumpId $dumpId *>&1 | Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE
$sw.Stop()

if ($code -ne 0) {
    Write-Log ("FAILED ({0}) after {1:hh\:mm\:ss}" -f $code, $sw.Elapsed)
} else {
    Write-Log ("pipeline finished in {0:hh\:mm\:ss}" -f $sw.Elapsed)
    Publish-Reports -DumpId $dumpId
}

# keep the log directory from growing without bound
Get-ChildItem $logDir -Filter 'run-*.log' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLogs |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $code
