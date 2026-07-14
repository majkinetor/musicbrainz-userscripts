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
        }

    A parameter given on the command line always beats its config counterpart.

.PARAMETER ConfigPath
    Path to the config script. Default: collection_sync.config.ps1 next to this script.

.PARAMETER Credential
    MusicBrainz account (UserName = editor name). When omitted, the config's CredentialsFile
    (an Export-Clixml'd credential) is used; when that's absent too, you are prompted.
    For an unattended scheduled task:
        Get-Credential | Export-Clixml $HOME\mb.cred          # one time, as the task's user
        # then either point CredentialsFile at it in the config, or pass it explicitly:
        .\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred)

.PARAMETER CreateMissing
    When a configured collection name doesn't exist on the account, create it (a private
    Release collection - MB's default) instead of skipping the entry. Creation goes through
    the website form (the WS2 API cannot create collections), using the same credential.
    Can also be set in the config (CreateMissing = $true).

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
    [string] $UserAgent = 'collection_sync/1.0 ( https://github.com/majkinetor )'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\musicbrainz\MusicBrainz.psm1') -Force

# Audio extensions that may carry a MUSICBRAINZ_ALBUMID tag.
$AudioExt = '.flac', '.mp3', '.m4a', '.ogg', '.opus', '.wma', '.ape', '.wav', '.aiff', '.aif', '.dsf', '.wv'

function Write-Head { param([string] $Text) Write-Host "`n$Text" -ForegroundColor Cyan }

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

# --- Auth ------------------------------------------------------------------
if (-not $Credential -and $cfg.CredentialsFile) {
    if (Test-Path -LiteralPath $cfg.CredentialsFile) { $Credential = Import-Clixml -LiteralPath $cfg.CredentialsFile }
    else { Write-Warning "CredentialsFile not found: $($cfg.CredentialsFile) - create it with: Get-Credential | Export-Clixml '$($cfg.CredentialsFile)'" }
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

    # --- canonicalize adds: a tag can carry a MERGED-away MBID -------------
    # MB silently stores the merge target on PUT and the browse returns the target, so an
    # outdated tag would be re-added (and its target re-removed) on every run, forever.
    # Resolve each candidate through MB (cheap - only the adds) and cancel the phantom pair.
    if ($toAdd.Count) {
        $removeSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$toRemove)
        $resolved  = [System.Collections.Generic.List[string]]::new()
        foreach ($id in $toAdd) {
            $canon = $id
            try { $canon = ([string](Get-MBRelease $id).id).ToLower() }
            catch { Write-Warning "  release $id not found on MusicBrainz - skipping ($($idFolder[$id]))"; continue }
            if ($canon -eq $id) { $resolved.Add($id); continue }
            Write-Host "  ~ $id was merged into $canon on MusicBrainz - re-tag '$($idFolder[$id])'" -ForegroundColor DarkYellow
            if ($removeSet.Contains($canon)) { [void]$removeSet.Remove($canon); continue }   # already there under the new id
            if ($currentSet.Contains($canon)) { continue }                                    # ditto, and nothing queued to remove
            $idFolder[$canon] = $idFolder[$id]
            $resolved.Add($canon)
        }
        $toAdd    = @($resolved | Select-Object -Unique)
        $toRemove = @($removeSet)
    }

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
