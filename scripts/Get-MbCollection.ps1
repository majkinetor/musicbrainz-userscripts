<#
.SYNOPSIS
    Downloads a MusicBrainz collection into a JSON file.

.DESCRIPTION
    Resolves the collection's entity type via the collection endpoint, then
    pages through the MusicBrainz browse API (100 items/request) while
    respecting the ~1 request/second rate limit, and writes the collection
    metadata together with all items to a JSON file.

    Works for any collection type (release, recording, artist, release-group,
    work, label, place, area, event, instrument, series) -- the entity type
    is detected automatically.

.PARAMETER Collection
    A MusicBrainz collection MBID, or any URL/string containing one.

.PARAMETER OutFile
    Output path. Defaults to <mbid>.json in the current directory.

.PARAMETER Inc
    Optional 'inc' sub-query passed to the browse request, e.g.
    'artist-credits+labels+recordings'. Valid values depend on the
    collection's entity type. Default: none.

.PARAMETER Raw
    Write only the items array instead of the {collection, items} wrapper.

.PARAMETER UserAgent
    User-Agent string. MusicBrainz requires a meaningful one with contact
    info -- replace the default with your own app/contact.

.EXAMPLE
    .\Get-MBCollection.ps1 https://musicbrainz.org/collection/0665e77a-62d7-4adb-b4eb-e9f98e96398e

.EXAMPLE
    .\Get-MBCollection.ps1 -Collection 0665e77a-62d7-4adb-b4eb-e9f98e96398e -OutFile mycol.json -Inc 'artist-credits'
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string] $Collection,

    [string] $OutFile,

    [string] $Inc = '',

    [switch] $Raw,

    [string] $UserAgent = 'MBCollectionDownloader/1.0 ( https://github.com/majkinetor )'
)

$ErrorActionPreference = 'Stop'

# --- Resolve MBID ----------------------------------------------------------
$mbidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
$m = [regex]::Match($Collection, $mbidPattern)
if (-not $m.Success) { throw "No valid MBID found in '$Collection'." }
$mbid = $m.Value.ToLower()

$base    = 'https://musicbrainz.org/ws/2'
$headers = @{ 'User-Agent' = $UserAgent }

# --- Throttled request helper (min 1.1s spacing, retry on transient errors) -
# MusicBrainz now sits behind Cloudflare, which intermittently rejects an
# otherwise-valid request with "400 Invalid mbid" (or 429/5xx under load). A
# persisted web session keeps the Cloudflare clearance cookie across requests,
# and transient statuses are retried with backoff so one flaky response doesn't
# abort the whole download.
$script:lastRequest = [datetime]::MinValue
$script:session     = $null
$minInterval        = [timespan]::FromMilliseconds(1100)
# Cloudflare's "Invalid mbid" streaks can last tens of seconds, so the retry
# budget is generous (≈2 min of backoff) — a valid-format MBID never gets a real
# 400, so retrying can't mask a genuine bad id.
$maxAttempts        = 8

function Invoke-MB {
    param([string] $Url)
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $wait = $minInterval - ([datetime]::UtcNow - $script:lastRequest)
        if ($wait -gt [timespan]::Zero) { Start-Sleep -Milliseconds ([int]$wait.TotalMilliseconds) }
        $script:lastRequest = [datetime]::UtcNow
        try {
            if ($null -eq $script:session) {
                $resp = Invoke-RestMethod -Uri $Url -Headers $headers -SessionVariable newSession -ErrorAction Stop
                $script:session = $newSession
                return $resp
            }
            return Invoke-RestMethod -Uri $Url -Headers $headers -WebSession $script:session -ErrorAction Stop
        }
        catch {
            $status = 0
            try { $status = [int]$_.Exception.Response.StatusCode } catch { }
            $body = ''
            try { $body = [string]$_.ErrorDetails.Message } catch { }

            # transient: Cloudflare's spurious "400 Invalid mbid", rate limiting,
            # and gateway/server errors. Everything else (e.g. a genuine 404) throws.
            $transient = ($status -in 429, 500, 502, 503, 504) -or
                         ($status -eq 400 -and $body -match 'Invalid mbid')
            if ($transient -and $attempt -lt $maxAttempts) {
                $delay = [math]::Min(20, 4 * $attempt) + (Get-Random -Minimum 0.0 -Maximum 1.0)   # backoff + jitter
                Write-Warning ("HTTP $status on attempt $attempt/$maxAttempts - retrying in {0:N1}s..." -f $delay)
                Start-Sleep -Seconds $delay
                continue
            }
            throw
        }
    }
}

# --- Collection metadata ---------------------------------------------------
Write-Host "Fetching collection $mbid ..."
$meta = Invoke-MB "$base/collection/${mbid}?fmt=json"

$entityType = $meta.'entity-type'
if (-not $entityType) { throw 'Could not determine entity type for collection.' }

$total = [int]$meta."$entityType-count"
Write-Host "Collection: '$($meta.name)'  type: $entityType  items: $total"

# --- Page through items ----------------------------------------------------
$items  = [System.Collections.Generic.List[object]]::new()
$limit  = 100
$offset = 0

while ($offset -lt $total) {
    $url = "$base/${entityType}?collection=$mbid&limit=$limit&offset=$offset&fmt=json"
    if ($Inc) { $url += "&inc=$Inc" }

    Write-Progress -Activity 'Downloading collection' `
                   -Status "$offset / $total" `
                   -PercentComplete ([math]::Min(100, $offset / [math]::Max(1, $total) * 100))

    $page = Invoke-MB $url

    # The item list is the only array-valued property in a browse response.
    $listProp = $page.PSObject.Properties |
                Where-Object { $_.Value -is [System.Array] } |
                Select-Object -First 1
    if (-not $listProp) { break }

    $batch = @($listProp.Value)
    if ($batch.Count -eq 0) { break }
    $items.AddRange($batch)

    $offset += $limit
}
Write-Progress -Activity 'Downloading collection' -Completed

# --- Build output ----------------------------------------------------------
if ($Raw) {
    $payload = $items
}
else {
    $payload = [ordered]@{
        collection = [ordered]@{
            id            = $meta.id
            name          = $meta.name
            type          = $meta.type
            'entity-type' = $entityType
            count         = $total
        }
        items = $items
    }
}

$json = ConvertTo-Json -InputObject $payload -Depth 100

# --- Write BOM-less UTF-8 --------------------------------------------------
if (-not $OutFile) { $OutFile = "$mbid.json" }
if (-not [System.IO.Path]::IsPathRooted($OutFile)) {
    $OutFile = Join-Path (Get-Location).Path $OutFile
}
[System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "Saved $($items.Count) item(s) to $OutFile"