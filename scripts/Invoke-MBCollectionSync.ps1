<#
.SYNOPSIS
    Mirror local music folders into MusicBrainz release collections.

.DESCRIPTION
    Reads a simple config that maps a collection NAME to a folder, then for each entry:
      1. resolves the collection's MBID (from the authenticated editor's collections),
      2. walks the folder tree and reads each release's MBID from its audio tags
         (MUSICBRAINZ_ALBUMID, via TagLibSharp),
      3. compares that set with the collection's current releases, and
      4. ADDS the ones on disk that are missing and REMOVES the ones in the collection
         that are no longer on disk (full mirror).

    Everything it does is printed. It runs once and exits -- designed for Task Scheduler.
    Removals are guarded by ShouldProcess, so -WhatIf shows the plan without changing anything.

    Config format (one entry per line; '#' comments and blank lines ignored):

        # <collection name> : <folder>
        various artists : m:\audio\various artists
        albums          : m:\audio\albums

    The name is everything before the first ':'; the folder is the rest (so drive letters
    like 'm:\...' are fine).

.PARAMETER ConfigPath
    Path to the config file. Default: Invoke-MBCollectionSync.config next to this script.

.PARAMETER Credential
    MusicBrainz account (UserName = editor name). Prompted if omitted. For an unattended
    scheduled task, save it once and pass it in, e.g.:
        Get-Credential | Export-Clixml $HOME\mb.cred          # one time, as the task's user
        .\Invoke-MBCollectionSync.ps1 -Credential (Import-Clixml $HOME\mb.cred)

.PARAMETER CreateMissing
    When a configured collection name doesn't exist on the account, create it (as a public
    Release collection) instead of skipping the entry. Creation goes through the website
    form (the WS2 API cannot create collections), using the same credential.

.PARAMETER UserAgent
    User-Agent for MusicBrainz requests.

.EXAMPLE
    .\Invoke-MBCollectionSync.ps1 -WhatIf

.EXAMPLE
    .\Invoke-MBCollectionSync.ps1 -Credential (Import-Clixml $HOME\mb.cred) -CreateMissing
#>

[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
    [string] $ConfigPath = (Join-Path $PSScriptRoot 'Invoke-MBCollectionSync.config'),
    [pscredential] $Credential,
    [switch] $CreateMissing,
    [string] $UserAgent = 'MBCollectionSync/1.0 ( https://github.com/majkinetor )'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'musicbrainz\MusicBrainz.psm1') -Force

# Audio extensions that may carry a MUSICBRAINZ_ALBUMID tag.
$AudioExt = '.flac', '.mp3', '.m4a', '.ogg', '.opus', '.wma', '.ape', '.wav', '.aiff', '.aif', '.dsf', '.wv'

function Write-Head { param([string] $Text) Write-Host "`n$Text" -ForegroundColor Cyan }

# --- Config ----------------------------------------------------------------
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config not found: $ConfigPath  (see Invoke-MBCollectionSync.config.example)"
}
$entries = foreach ($line in Get-Content -LiteralPath $ConfigPath) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf(':')
    if ($i -lt 1) { Write-Warning "Ignoring malformed config line: $line"; continue }
    [pscustomobject]@{ Name = $t.Substring(0, $i).Trim(); Path = $t.Substring($i + 1).Trim() }
}
if (-not $entries) { throw "No usable entries in $ConfigPath." }

# --- Auth ------------------------------------------------------------------
if (-not $Credential) { $Credential = Get-Credential -Message 'MusicBrainz login (editor name + password)' }
Set-MBUserAgent $UserAgent
Set-MBClient 'Invoke-MBCollectionSync-1.0'   # recorded by MB on collection edits
Connect-MB -Credential $Credential           # verifies the login + stores it for all module calls
$editor = $Credential.UserName

Write-Host "MusicBrainz collection sync  -  editor '$editor'  -  $($entries.Count) collection(s)"
if ($WhatIfPreference) { Write-Host '(WhatIf: no changes will be made)' -ForegroundColor DarkYellow }

$grandAdded = 0; $grandRemoved = 0
foreach ($e in $entries) {
    Write-Head "=== $($e.Name)  <-  $($e.Path) ==="

    if (-not (Test-Path -LiteralPath $e.Path)) { Write-Warning "Folder not found - skipping: $($e.Path)"; continue }

    # resolve the configured NAME to a release collection (policy lives here, not in the module)
    $col = @(Get-MBCollection $e.Name)
    if ($col.Count -gt 1)  { Write-Warning "More than one collection named '$($e.Name)' - skipping."; continue }
    if ($col.Count -eq 1 -and $col[0].'entity-type' -ne 'release') {
        Write-Warning "Collection '$($e.Name)' holds '$($col[0].'entity-type')' entities, not releases - skipping."; continue
    }
    $colId = if ($col.Count -eq 1) { $col[0].id } else { $null }
    if (-not $colId) {
        if (-not $CreateMissing) { Write-Warning "No collection named '$($e.Name)' - skipping (use -CreateMissing to create it)."; continue }
        if (-not $PSCmdlet.ShouldProcess($e.Name, 'create collection')) { continue }   # -WhatIf: nothing to diff yet
        Write-Host "  Collection doesn't exist - creating it..." -ForegroundColor Yellow
        try { $colId = New-MBCollection -Name $e.Name; Write-Host "  Created collection '$($e.Name)'." }
        catch { Write-Warning "  creation failed: $($_.Exception.Message)"; continue }
    }
    Write-Host "  Collection MBID: $colId"

    # --- scan folders: one MUSICBRAINZ_ALBUMID per audio-bearing folder ----
    $desired  = [System.Collections.Generic.HashSet[string]]::new()
    $idFolder = @{}   # release MBID -> folder name (for readable add logs)
    $untagged = [System.Collections.Generic.List[string]]::new()
    $folders  = @($e.Path) + @(Get-ChildItem -LiteralPath $e.Path -Recurse -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    $scanned  = 0
    foreach ($dir in $folders) {
        $audio = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
                 Where-Object { $AudioExt -contains $_.Extension.ToLower() } | Select-Object -First 1
        if (-not $audio) { continue }
        $scanned++
        $id = Get-MBReleaseIdFromFile -Path $audio.FullName
        if ($id) { [void]$desired.Add($id); if (-not $idFolder.ContainsKey($id)) { $idFolder[$id] = Split-Path -Leaf $dir } }
        else { $untagged.Add($dir) }
    }
    Write-Host "  Scanned $scanned release folder(s) -> $($desired.Count) distinct tagged release(s)."
    foreach ($u in $untagged) { Write-Warning "  no MUSICBRAINZ_ALBUMID: $u" }

    # --- current collection contents ---------------------------------------
    $currentSet = [System.Collections.Generic.HashSet[string]]::new()
    $idTitle    = @{}   # release MBID -> MB title (for readable remove logs — no folder on disk)
    foreach ($r in (Get-MBCollectionRelease -CollectionId $colId)) {
        $rid = ([string]$r.id).ToLower()
        [void]$currentSet.Add($rid)
        $idTitle[$rid] = [string]$r.title
    }
    Write-Host "  Collection currently holds $($currentSet.Count) release(s)."

    $toAdd    = @($desired    | Where-Object { -not $currentSet.Contains($_) })
    $toRemove = @($currentSet | Where-Object { -not $desired.Contains($_) })

    if ($toAdd.Count -eq 0 -and $toRemove.Count -eq 0) {
        Write-Host '  Already in sync.' -ForegroundColor Green
    }
    else {
        if ($toAdd.Count) {
            Write-Host "  + Adding $($toAdd.Count):" -ForegroundColor Yellow
            $toAdd | ForEach-Object { Write-Host "      + $_  $($idFolder[$_])" }
            if ($PSCmdlet.ShouldProcess($e.Name, "add $($toAdd.Count) release(s)")) {
                Add-MBCollectionRelease -CollectionId $colId -ReleaseId $toAdd
                $grandAdded += $toAdd.Count
            }
        }
        if ($toRemove.Count) {
            Write-Host "  - Removing $($toRemove.Count):" -ForegroundColor Yellow
            $toRemove | ForEach-Object { Write-Host "      - $_  $($idTitle[$_])" }
            if ($PSCmdlet.ShouldProcess($e.Name, "remove $($toRemove.Count) release(s)")) {
                Remove-MBCollectionRelease -CollectionId $colId -ReleaseId $toRemove
                $grandRemoved += $toRemove.Count
            }
        }
    }
}

Write-Host "`nDone. Added $grandAdded, removed $grandRemoved across $($entries.Count) collection(s)." -ForegroundColor Green
