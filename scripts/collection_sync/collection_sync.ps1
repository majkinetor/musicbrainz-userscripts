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

    The config is a .ps1 that returns a hashtable (extensible - more options may appear
    later); `collections` lists the name/folder pairs to mirror:

        @{
            collections     = @(
                @{ name = 'various artists'; path = 'm:\audio\various artists' }
                @{ name = 'albums';          path = 'm:\audio\albums' }
            )
            CreateMissing   = $true                # optional - as if -CreateMissing was passed
            CredentialsFile = "$HOME\mb.cred"      # optional - Export-Clixml'd credential
            ThrottleLimit   = 4                    # optional - parallel MusicBrainz workers
        }

    A parameter given on the command line always beats its config counterpart.

.PARAMETER ConfigPath
    Path to the config script. Default: collection_sync.config.ps1 next to this script.

.PARAMETER Credential
    MusicBrainz account (UserName = editor name). When omitted, the config's CredentialsFile
    is used; if that file doesn't exist yet, you are prompted ONCE and it is created there,
    so later runs are unattended. With no CredentialsFile either, you are prompted each run.
    The file is written with Export-Clixml (cross-platform): on Windows it is DPAPI-encrypted
    per user; on Linux/macOS it is merely encoded - protect it with file permissions.

.PARAMETER CreateMissing
    When a configured collection name doesn't exist on the account, create it (a private
    Release collection - MB's default) instead of skipping the entry. Creation goes through
    the website form (the WS2 API cannot create collections), using the same credential.
    Can also be set in the config (CreateMissing = $true).

.PARAMETER ThrottleLimit
    Parallel background workers for MusicBrainz reads (collection pages, release lookups).
    They share one request schedule and one retry backoff, so a rate-limit answer from any
    worker pauses all of them. 1 = fully sequential. Default 4; config: ThrottleLimit.

.PARAMETER UserAgent
    User-Agent for MusicBrainz requests.

.EXAMPLE
    .\collection_sync.ps1 -WhatIf

.EXAMPLE
    .\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred) -CreateMissing
#>

[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
    [string] $ConfigPath = (Join-Path $PSScriptRoot 'collection_sync.config.ps1'),
    [pscredential] $Credential,
    [switch] $CreateMissing,
    [ValidateRange(1, 16)][int] $ThrottleLimit = 4,
    [string] $UserAgent = 'collection_sync/1.0 ( https://github.com/majkinetor )'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\musicbrainz\MusicBrainz.psm1') -Force
# -Verbose shows the raw MusicBrainz communication (every request URL, status, response
# excerpt). Preference variables don't cross the module boundary, so push it in explicitly.
if ($VerbosePreference -ne 'SilentlyContinue') { & (Get-Module MusicBrainz) { $script:VerbosePreference = 'Continue' } }

# Audio extensions that may carry a MUSICBRAINZ_ALBUMID tag.
$AudioExt = '.flac', '.mp3', '.m4a', '.ogg', '.opus', '.wma', '.ape', '.wav', '.aiff', '.aif', '.dsf', '.wv'

function Write-Head { param([string] $Text) Write-Host "`n$Text" -ForegroundColor Cyan }

function Read-Collection {
    # Current contents of a release collection: @{ Set = HashSet of MBIDs; Titles = MBID -> title }.
    param([string] $ColId)
    $set = [System.Collections.Generic.HashSet[string]]::new()
    $titles = @{}
    foreach ($r in (Get-MBCollectionRelease -CollectionId $ColId -ThrottleLimit $ThrottleLimit)) {
        $rid = ([string]$r.id).ToLower()
        [void]$set.Add($rid)
        $titles[$rid] = [string]$r.title
    }
    @{ Set = $set; Titles = $titles }
}

# --- Config: a .ps1 returning @{ collections = @( @{ name; path } ... ) } ---
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config not found: $ConfigPath  (see collection_sync.config.example.ps1)"
}
$cfg = & $ConfigPath
if ($cfg -isnot [System.Collections.IDictionary] -or -not $cfg.collections) {
    throw "Config must return a hashtable with a 'collections' list ($ConfigPath)."
}
$entries = foreach ($c in @($cfg.collections)) {
    if (-not $c.name -or -not $c.path) { Write-Warning "Ignoring collections entry without name/path: $($c | ConvertTo-Json -Compress -Depth 3)"; continue }
    [pscustomobject]@{ Name = [string]$c.name; Path = [string]$c.path }
}
if (-not $entries) { throw "No usable 'collections' entries in $ConfigPath." }

# config-provided options — an explicit command-line parameter always wins
if (-not $PSBoundParameters.ContainsKey('CreateMissing') -and $null -ne $cfg.CreateMissing) {
    $CreateMissing = [bool]$cfg.CreateMissing
}
if (-not $PSBoundParameters.ContainsKey('ThrottleLimit') -and $cfg.ThrottleLimit) {
    $ThrottleLimit = [int]$cfg.ThrottleLimit
}

# --- Auth ------------------------------------------------------------------
if (-not $Credential -and $cfg.CredentialsFile) {
    if (Test-Path -LiteralPath $cfg.CredentialsFile) { $Credential = Import-Clixml -LiteralPath $cfg.CredentialsFile }
    else {
        # first run: ask once and save to the configured path, so later runs are unattended
        Write-Host "CredentialsFile not found: $($cfg.CredentialsFile) - enter the MusicBrainz login once, it will be saved there." -ForegroundColor Yellow
        $Credential = Get-Credential -Message 'MusicBrainz login (editor name + password)'
        $dir = Split-Path -Parent $cfg.CredentialsFile
        if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        $Credential | Export-Clixml -LiteralPath $cfg.CredentialsFile
        Write-Host "Saved to $($cfg.CredentialsFile) (Windows: DPAPI-encrypted per user; Linux/macOS: protect with file permissions)."
    }
}
if (-not $Credential) { $Credential = Get-Credential -Message 'MusicBrainz login (editor name + password)' }
Set-MBUserAgent $UserAgent
Set-MBClient 'collection_sync-1.0'   # recorded by MB on collection edits
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
        if ($id -and $id -notmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') {
            Write-Warning "  malformed MUSICBRAINZ_ALBUMID '$id': $dir"
            $id = $null
        }
        if ($id) { [void]$desired.Add($id); if (-not $idFolder.ContainsKey($id)) { $idFolder[$id] = Split-Path -Leaf $dir } }
        else { $untagged.Add($dir) }
    }
    Write-Host "  Scanned $scanned release folder(s) -> $($desired.Count) distinct tagged release(s)."
    foreach ($u in $untagged) { Write-Warning "  no MUSICBRAINZ_ALBUMID: $u" }

    # --- current collection contents ---------------------------------------
    $cur = Read-Collection $colId
    Write-Host "  Collection currently holds $($cur.Set.Count) release(s)."

    # --- adds go FIRST, straight from the tags: PUT needs only the MBIDs ----
    # No per-release lookups here - that used to cost one request per add (a first sync of a
    # large library took hours). Problem ids are found afterwards from a single re-browse.
    $toAdd  = @($desired | Where-Object { -not $cur.Set.Contains($_) })
    $didAdd = $false
    if ($toAdd.Count) {
        Write-Host "  + Adding $($toAdd.Count):" -ForegroundColor Yellow
        $toAdd | ForEach-Object { Write-Host "      + $_  $($idFolder[$_])" }
        if ($PSCmdlet.ShouldProcess($e.Name, "add $($toAdd.Count) release(s)")) {
            try { Add-MBCollectionRelease -CollectionId $colId -ReleaseId $toAdd; $didAdd = $true; $grandAdded += $toAdd.Count }
            catch {
                # one nonexistent id fails its whole PUT batch - resolve every id on parallel
                # workers (they share one throttle/backoff), drop the bad ones and retry
                Write-Warning "  add failed ($($_.Exception.Message)) - resolving $($toAdd.Count) id(s) to isolate the bad one(s) ($ThrottleLimit workers)..."
                $lookups = Invoke-MBApiBulk -Path @($toAdd | ForEach-Object { "release/${_}?fmt=json" }) -ThrottleLimit $ThrottleLimit
                $good = [System.Collections.Generic.List[string]]::new()
                for ($i = 0; $i -lt $toAdd.Count; $i++) {
                    if ($lookups[$i].Ok) { $good.Add(([string]$lookups[$i].Result.id).ToLower()) }
                    else { Write-Warning "  release $($toAdd[$i]) not on MusicBrainz - skipping ($($idFolder[$toAdd[$i]])): $($lookups[$i].Error)" }
                }
                $good = @($good | Select-Object -Unique | Where-Object { -not $cur.Set.Contains($_) })
                if ($good.Count) { Add-MBCollectionRelease -CollectionId $colId -ReleaseId $good; $didAdd = $true; $grandAdded += $good.Count }
            }
        }
    }

    # --- verify the adds and catch MERGED-away tags --------------------------
    # A tag can carry an MBID that was later merged on MusicBrainz: PUT silently stores the
    # merge TARGET, so the tagged id never shows up in the collection. One cheap re-browse
    # exposes exactly those ids, and only they need resolving (usually none).
    $after = if ($didAdd) { Read-Collection $colId } else { $cur }
    $protected    = [System.Collections.Generic.HashSet[string]]::new()   # merge targets of our adds - never remove
    $stillMissing = @($desired | Where-Object { -not $after.Set.Contains($_) })
    if ($stillMissing.Count -and -not $WhatIfPreference) {
        $lookups = Invoke-MBApiBulk -Path @($stillMissing | ForEach-Object { "release/${_}?fmt=json" }) -ThrottleLimit $ThrottleLimit
        for ($i = 0; $i -lt $stillMissing.Count; $i++) {
            $id = $stillMissing[$i]
            if (-not $lookups[$i].Ok) { Write-Warning "  release $id not on MusicBrainz - skipping ($($idFolder[$id])): $($lookups[$i].Error)"; continue }
            $canon = ([string]$lookups[$i].Result.id).ToLower()
            if ($canon -ne $id) {
                Write-Host "  ~ $id was merged into $canon on MusicBrainz - re-tag '$($idFolder[$id])'" -ForegroundColor DarkYellow
                [void]$protected.Add($canon)
            }
            else { Write-Warning "  release $id did not stick in the collection ($($idFolder[$id])) - will retry next run" }
        }
    }

    # --- removals LAST: entries with no folder on disk ------------------------
    $toRemove = @($after.Set | Where-Object { -not $desired.Contains($_) -and -not $protected.Contains($_) })
    if ($toRemove.Count) {
        Write-Host "  - Removing $($toRemove.Count):" -ForegroundColor Yellow
        $toRemove | ForEach-Object { Write-Host "      - $_  $($after.Titles[$_])" }
        if ($PSCmdlet.ShouldProcess($e.Name, "remove $($toRemove.Count) release(s)")) {
            Remove-MBCollectionRelease -CollectionId $colId -ReleaseId $toRemove
            $grandRemoved += $toRemove.Count
        }
    }
    if ($toAdd.Count -eq 0 -and $toRemove.Count -eq 0) {
        Write-Host '  Already in sync.' -ForegroundColor Green
    }

    # --- stamp the description with the sync date + item count --------------
    $finalCount = $after.Set.Count - $toRemove.Count
    if ($WhatIfPreference) { $finalCount += $toAdd.Count }   # adds were only displayed
    $stamp = "Synced on $(Get-Date -Format 'yyyy-MM-dd HH:mm') - $finalCount release(s)"
    if ($PSCmdlet.ShouldProcess($e.Name, "set description '$stamp'")) {
        try { Set-MBCollection $colId -Description $stamp; Write-Host "  $stamp" }
        catch { Write-Warning "  description update failed: $($_.Exception.Message)" }
    }
}

Write-Host "`nDone. Added $grandAdded, removed $grandRemoved across $($entries.Count) collection(s)." -ForegroundColor Green
