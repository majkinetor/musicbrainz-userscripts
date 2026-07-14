<#
.SYNOPSIS
    Minimal MusicBrainz web-service helpers used by the collection tooling.

.DESCRIPTION
    Provides:
      * Invoke-MBApi            - throttled (1 req/s) request helper with retry/backoff and a
                                  persisted web session (Cloudflare clearance), GET/PUT/DELETE.
      * Get-MBUserCollection    - list an editor's collections (public + private when authed).
      * Resolve-MBCollectionId  - map a collection NAME to its MBID for an editor.
      * Get-MBCollectionInfo     - collection metadata (name, entity-type, counts).
      * Get-MBCollectionReleaseId - every release MBID in a release collection (paged).
      * Add-MBCollectionRelease / Remove-MBCollectionRelease - edit a release collection
                                  (batched 400/req; requires authentication + a client id).
      * Get-MBReleaseTitle       - a release's title (for human-readable output).
      * Get-MBReleaseIdFromFile  - read MUSICBRAINZ_ALBUMID from an audio file (TagLibSharp,
                                  auto-provisioned into .\lib on first use).

    Authentication (for the editing functions) is HTTP Digest with a MusicBrainz account:
    pass a [pscredential] whose UserName is the editor name.
#>

$script:MBBase        = 'https://musicbrainz.org/ws/2'
$script:MBClient      = 'Invoke-MBCollectionSync-1.0'
$script:MBUserAgent   = 'MBCollectionSync/1.0 ( https://github.com/majkinetor )'
$script:MBLastRequest = [datetime]::MinValue
$script:MBSession     = $null
# MusicBrainz behind Cloudflare intermittently answers a valid request with "400 Invalid mbid"
# in streaks that can run a couple of minutes; a generous retry budget (~5 min) rides them out.
# A genuinely bad (wrong-format) MBID never gets a real 400, so retrying can't mask a real error.
$script:MBMinInterval = [timespan]::FromMilliseconds(1100)
$script:MBMaxAttempts = 14

function Set-MBUserAgent {
    <#.SYNOPSIS Override the User-Agent sent with every request.#>
    param([Parameter(Mandatory)][string] $UserAgent)
    $script:MBUserAgent = $UserAgent
}

function Invoke-MBApi {
    <#
    .SYNOPSIS Throttled MusicBrainz request with retry/backoff and a persisted session.
    .PARAMETER Path A path relative to /ws/2 (e.g. "collection/<id>?fmt=json") or a full URL.
    .PARAMETER Method GET (default), PUT or DELETE.
    .PARAMETER Credential Account credential for authenticated (editing) requests.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Path,
        [ValidateSet('GET', 'PUT', 'DELETE')][string] $Method = 'GET',
        [pscredential] $Credential
    )
    $url = if ($Path -match '^https?://') { $Path } else { "$script:MBBase/$Path" }

    for ($attempt = 1; $attempt -le $script:MBMaxAttempts; $attempt++) {
        $wait = $script:MBMinInterval - ([datetime]::UtcNow - $script:MBLastRequest)
        if ($wait -gt [timespan]::Zero) { Start-Sleep -Milliseconds ([int]$wait.TotalMilliseconds) }
        $script:MBLastRequest = [datetime]::UtcNow

        $params = @{
            Uri         = $url
            Method      = $Method
            Headers     = @{ 'User-Agent' = $script:MBUserAgent }
            ErrorAction = 'Stop'
        }
        if ($Credential) { $params.Credential = $Credential }

        try {
            if ($null -eq $script:MBSession) {
                $params.SessionVariable = 'newSession'
                $resp = Invoke-RestMethod @params
                $script:MBSession = $newSession
                return $resp
            }
            $params.WebSession = $script:MBSession
            return Invoke-RestMethod @params
        }
        catch {
            $status = 0; try { $status = [int]$_.Exception.Response.StatusCode } catch { }
            $body = '';  try { $body = [string]$_.ErrorDetails.Message } catch { }

            if ($status -eq 401) { throw "MusicBrainz rejected the credentials (401). Check the editor name / password." }

            # Cloudflare's spurious "400 Invalid mbid", rate limiting and gateway/server errors
            # are transient; a genuine 404 (or anything else) is thrown immediately.
            $transient = ($status -in 429, 500, 502, 503, 504) -or
                         ($status -eq 400 -and $body -match 'Invalid mbid')
            if ($transient -and $attempt -lt $script:MBMaxAttempts) {
                $delay = [math]::Min(30, 4 * $attempt) + (Get-Random -Minimum 0.0 -Maximum 1.0)
                Write-Warning ("MB HTTP $status on attempt $attempt/$($script:MBMaxAttempts) - retrying in {0:N1}s..." -f $delay)
                Start-Sleep -Seconds $delay
                continue
            }
            throw
        }
    }
}

function Get-MBUserCollection {
    <#.SYNOPSIS List an editor's collections. Pass -Credential to include private ones.#>
    param(
        [Parameter(Mandatory)][string] $Editor,
        [pscredential] $Credential
    )
    $enc = [uri]::EscapeDataString($Editor)
    $resp = Invoke-MBApi -Path "collection?editor=$enc&limit=100&fmt=json" -Credential $Credential
    if ($resp.PSObject.Properties.Name -contains 'collections') { return @($resp.collections) }
    return @()
}

function Resolve-MBCollectionId {
    <#.SYNOPSIS Map a release-collection NAME to its MBID for an editor.#>
    param(
        [Parameter(Mandatory)][string] $Name,
        [Parameter(Mandatory)][string] $Editor,
        [pscredential] $Credential
    )
    $cols  = Get-MBUserCollection -Editor $Editor -Credential $Credential
    $match = @($cols | Where-Object { $_.name -eq $Name })
    if ($match.Count -eq 0) {
        $known = ($cols | ForEach-Object { $_.name }) -join ', '
        throw "No collection named '$Name' for editor '$Editor'. Known: $known"
    }
    if ($match.Count -gt 1) { throw "Editor '$Editor' has more than one collection named '$Name'." }
    if ($match[0].'entity-type' -ne 'release') {
        throw "Collection '$Name' holds '$($match[0].'entity-type')' entities, not releases."
    }
    return $match[0].id
}

function Get-MBCollectionInfo {
    <#.SYNOPSIS Collection metadata (name, entity-type, item count).#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [pscredential] $Credential
    )
    # ${} braces required: in PS7 a trailing '?' is parsed as part of the variable name
    Invoke-MBApi -Path "collection/${CollectionId}?fmt=json" -Credential $Credential
}

function Get-MBCollectionReleaseId {
    <#.SYNOPSIS Every release MBID in a release collection (lower-cased), paged 100/req.#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [pscredential] $Credential
    )
    $meta  = Get-MBCollectionInfo -CollectionId $CollectionId -Credential $Credential
    $total = [int]$meta.'release-count'
    $ids   = [System.Collections.Generic.List[string]]::new()
    $limit = 100; $offset = 0
    while ($offset -lt $total) {
        $page = Invoke-MBApi -Path "release?collection=$CollectionId&limit=$limit&offset=$offset&fmt=json" -Credential $Credential
        $batch = @($page.releases)
        if ($batch.Count -eq 0) { break }
        foreach ($r in $batch) { $ids.Add(([string]$r.id).ToLower()) }
        $offset += $limit
    }
    return $ids
}

function Add-MBCollectionRelease {
    <#.SYNOPSIS Add releases to a collection (batched 400/req). Requires -Credential.#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId,
        [Parameter(Mandatory)][pscredential] $Credential
    )
    Invoke-MBCollectionEdit -Method PUT -CollectionId $CollectionId -ReleaseId $ReleaseId -Credential $Credential
}

function Remove-MBCollectionRelease {
    <#.SYNOPSIS Remove releases from a collection (batched 400/req). Requires -Credential.#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId,
        [Parameter(Mandatory)][pscredential] $Credential
    )
    Invoke-MBCollectionEdit -Method DELETE -CollectionId $CollectionId -ReleaseId $ReleaseId -Credential $Credential
}

function Invoke-MBCollectionEdit {
    # (internal) shared PUT/DELETE batching for the collection editors above.
    param(
        [Parameter(Mandatory)][ValidateSet('PUT', 'DELETE')][string] $Method,
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId,
        [Parameter(Mandatory)][pscredential] $Credential
    )
    for ($i = 0; $i -lt $ReleaseId.Count; $i += 400) {
        $chunk = $ReleaseId[$i..([math]::Min($i + 399, $ReleaseId.Count - 1))]
        $list  = ($chunk -join ';')
        $null  = Invoke-MBApi -Method $Method -Credential $Credential `
                    -Path "collection/$CollectionId/releases/$list`?client=$($script:MBClient)"
    }
}

function Get-MBReleaseTitle {
    <#.SYNOPSIS A release's title (falls back to the MBID on error).#>
    param(
        [Parameter(Mandatory)][string] $Id,
        [pscredential] $Credential
    )
    try { return (Invoke-MBApi -Path "release/${Id}?fmt=json" -Credential $Credential).title }
    catch { return $Id }
}

# --- Audio-tag reading (MUSICBRAINZ_ALBUMID) via TagLibSharp -----------------
function Initialize-MBTagLib {
    <#.SYNOPSIS Ensure TagLibSharp is loaded; download + cache it into .\lib on first use.#>
    param([string] $Version = '2.3.0')
    if ('TagLib.File' -as [type]) { return }

    $lib = Join-Path $PSScriptRoot 'lib'
    $dll = Join-Path $lib 'TagLibSharp.dll'
    if (-not (Test-Path -LiteralPath $dll)) {
        New-Item -ItemType Directory -Force -Path $lib | Out-Null
        $nupkg = Join-Path $lib "taglibsharp.$Version.nupkg"
        Write-Host "Downloading TagLibSharp $Version (one-time) ..."
        Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/TagLibSharp/$Version" -OutFile $nupkg -UseBasicParsing
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($nupkg)
        try {
            $entry = $zip.Entries | Where-Object { $_.FullName -match 'lib/netstandard2\.0/TagLibSharp\.dll$' } | Select-Object -First 1
            if (-not $entry) { $entry = $zip.Entries | Where-Object { $_.FullName -match 'TagLibSharp\.dll$' } | Select-Object -First 1 }
            if (-not $entry) { throw 'TagLibSharp.dll not found inside the NuGet package.' }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dll, $true)
        }
        finally { $zip.Dispose() }
        Remove-Item -LiteralPath $nupkg -Force -ErrorAction SilentlyContinue
    }
    Add-Type -Path $dll
}

function Get-MBReleaseIdFromFile {
    <#.SYNOPSIS Read MUSICBRAINZ_ALBUMID (release MBID, lower-cased) from an audio file, or $null.#>
    param([Parameter(Mandatory)][string] $Path)
    Initialize-MBTagLib
    $f = $null
    try { $f = [TagLib.File]::Create($Path) } catch { return $null }
    try   { $id = $f.Tag.MusicBrainzReleaseId }
    catch { $id = $null }
    finally { if ($f) { $f.Dispose() } }
    if ([string]::IsNullOrWhiteSpace($id)) { return $null }
    return $id.Trim().ToLower()
}

Export-ModuleMember -Function `
    Set-MBUserAgent, Invoke-MBApi, Get-MBUserCollection, Resolve-MBCollectionId, `
    Get-MBCollectionInfo, Get-MBCollectionReleaseId, Add-MBCollectionRelease, `
    Remove-MBCollectionRelease, Get-MBReleaseTitle, Initialize-MBTagLib, Get-MBReleaseIdFromFile
