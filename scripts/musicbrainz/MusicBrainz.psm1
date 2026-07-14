<#
.SYNOPSIS
    General-purpose MusicBrainz helpers for PowerShell.

.DESCRIPTION
    Standalone module — no assumptions about the calling script. Callers identify
    themselves via Set-MBUserAgent / Set-MBClient (sensible generic defaults apply).

    Provides:
      * Connect-MB              - authenticate once (verifies the account, stores the credential
                                  module-wide); afterwards no function needs -Credential.
      * Invoke-MBApi            - throttled (1 req/s) request helper with retry/backoff and a
                                  persisted web session (Cloudflare clearance), GET/PUT/DELETE.
      * Get-MBCollection        - collections: all of an editor's without -Id (private included
                                  for the Connect-MB user), one by MBID or name with -Id:
                                  $library = Get-MBCollection 'library'
      * Get-MBCollectionRelease - every release in a release collection (full objects, paged).
      * Add-MBCollectionRelease / Remove-MBCollectionRelease - edit a release collection
                                  (batched 400/req; requires authentication + a client id).
      * Get-MBRelease            - a release by MBID (generic; pick fields off the object).
      * Get-MBReleaseIdFromFile  - read MUSICBRAINZ_ALBUMID from an audio file (TagLibSharp,
                                  auto-provisioned into .\lib on first use).
      * New-MBCollection         - create a collection. The WS2 API cannot create collections,
                                  so this logs into the WEBSITE (cookie session) and submits
                                  the /collection/create form. Returns the new MBID.
      * Set-MBCollection         - edit a collection's name/description (same website-form
                                  mechanism; type/privacy/collaborators preserved).

    Interactive use:
        Import-Module .\MusicBrainz.psm1
        Connect-MB                                 # prompts, verifies, remembers
        Get-MBCollection                           # ALL your collections (incl. private)
        $library = Get-MBCollection 'library'      # one, by name (or MBID)
        Get-MBCollectionRelease $library.id | % title

    Authentication is HTTP Digest with a MusicBrainz account ([pscredential] whose UserName is
    the editor name). Call Connect-MB once — the credential is held module-wide and every
    function uses it from there; none take a -Credential parameter. New-MBCollection uses the
    same credential for its website login.
#>

$script:MBServer             = 'https://musicbrainz.org'
$script:MBBase               = "$script:MBServer/ws/2"
$script:MBClient             = 'PowerShell-MusicBrainz/1.0'
$script:MBUserAgent          = 'PowerShell-MusicBrainz/1.0 ( https://github.com/majkinetor )'
$script:MBLastRequestTime    = [datetime]::MinValue
$script:MBSession            = $null
# MusicBrainz allows ~1 request/second — consecutive API requests are spaced at least this far apart.
$script:MBMinRequestInterval = [timespan]::FromMilliseconds(1100)
# MusicBrainz behind Cloudflare intermittently answers a valid request with "400 Invalid mbid"
# in streaks that can run a couple of minutes; a generous retry budget (~5 min) rides them out.
# A genuinely bad (wrong-format) MBID never gets a real 400, so retrying can't mask a real error.
$script:MBMaxRequestAttempts = 14

function Set-MBUserAgent {
    <#.SYNOPSIS Override the User-Agent sent with every request.#>
    param([Parameter(Mandatory)][string] $UserAgent)
    $script:MBUserAgent = $UserAgent
}

function Set-MBClient {
    <#.SYNOPSIS Override the client id MusicBrainz records on collection edits (client= query).#>
    param([Parameter(Mandatory)][string] $Client)
    $script:MBClient = $Client
}

function Set-MBServer {
    <#.SYNOPSIS Point the module at another MusicBrainz server (e.g. https://beta.musicbrainz.org).#>
    param([Parameter(Mandatory)][string] $Server)
    $script:MBServer = $Server.TrimEnd('/')
    $script:MBBase   = "$script:MBServer/ws/2"
    $script:MBSession = $null; $script:MBWebSession = $null   # sessions are per-server
}

$script:MBCredential = $null

function Connect-MB {
    <#
    .SYNOPSIS Authenticate to MusicBrainz. The credential is held module-wide; every other
              function uses it from there.
    .DESCRIPTION Prompts for the account when no credential is given (interactive use:
                 Import-Module ...; Connect-MB; Get-MBCollection). Verifies the login
                 against an authenticated endpoint; a failed verification leaves the module
                 unauthenticated.
    #>
    param([pscredential] $Credential)
    if (-not $Credential) { $Credential = Get-Credential -Message 'MusicBrainz login (editor name + password)' }
    $script:MBCredential = $Credential
    try {
        # verification: /ws/2/collection without editor= requires auth and returns OWN collections
        $resp = Invoke-MBApi -Path 'collection?fmt=json'
    }
    catch { $script:MBCredential = $null; throw }
    $n = @($resp.collections).Count
    Write-Host "Connected to MusicBrainz as '$($Credential.UserName)' ($n collection(s))."
}

function Assert-MBConnected {
    # (internal) guard for functions that require authentication.
    if (-not $script:MBCredential) { throw 'Not authenticated - run Connect-MB first.' }
}

function Invoke-MBApi {
    <#
    .SYNOPSIS Throttled MusicBrainz request with retry/backoff and a persisted session.
              Uses the Connect-MB credential automatically when present.
    .PARAMETER Path A path relative to /ws/2 (e.g. "collection/<id>?fmt=json") or a full URL.
    .PARAMETER Method GET (default), PUT or DELETE.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Path,
        [ValidateSet('GET', 'PUT', 'DELETE')][string] $Method = 'GET'
    )
    $url = if ($Path -match '^https?://') { $Path } else { "$script:MBBase/$Path" }
    # Cache-buster: identical browse URLs get served from an edge cache (observed: 40-80ms
    # responses with a stale release-count vs 200-300ms fresh ones), which made a collection
    # look like it never changed. A unique query value forces a fresh response.
    if ($Method -eq 'GET') { $url += ($url.Contains('?') ? '&' : '?') + "_=$([datetime]::UtcNow.Ticks)" }
    $Credential = $script:MBCredential

    for ($attempt = 1; $attempt -le $script:MBMaxRequestAttempts; $attempt++) {
        $wait = $script:MBMinRequestInterval - ([datetime]::UtcNow - $script:MBLastRequestTime)
        if ($wait -gt [timespan]::Zero) { Start-Sleep -Milliseconds ([int]$wait.TotalMilliseconds) }
        $script:MBLastRequestTime = [datetime]::UtcNow

        $params = @{
            Uri         = $url
            Method      = $Method
            Headers     = @{ 'User-Agent' = $script:MBUserAgent; 'Cache-Control' = 'no-cache' }
            ErrorAction = 'Stop'
        }
        if ($Credential) { $params.Credential = $Credential }

        Write-Verbose "MB -> $Method $url (attempt $attempt, auth=$([bool]$Credential))"
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            if ($null -eq $script:MBSession) {
                $params.SessionVariable = 'newSession'
                $resp = Invoke-RestMethod @params
                $script:MBSession = $newSession
            }
            else {
                $params.WebSession = $script:MBSession
                $resp = Invoke-RestMethod @params
            }
            if ($VerbosePreference -ne 'SilentlyContinue') {
                $body = if ($resp -is [xml]) { $resp.OuterXml }                                    # PUT/DELETE answer with XML
                        elseif ($resp -is [string]) { $resp }
                        else { try { ConvertTo-Json -InputObject $resp -Compress -Depth 3 3>$null } catch { [string]$resp } }   # 3>$null: the depth-truncation warning is expected noise
                if ($body.Length -gt 300) { $body = $body.Substring(0, 300) + '...' }
                Write-Verbose ("MB <- OK in {0}ms: {1}" -f $sw.ElapsedMilliseconds, $body)
            }
            return $resp
        }
        catch {
            $status = 0; try { $status = [int]$_.Exception.Response.StatusCode } catch { }
            $body = '';  try { $body = [string]$_.ErrorDetails.Message } catch { }
            Write-Verbose ("MB <- HTTP {0} in {1}ms: {2}" -f $status, $sw.ElapsedMilliseconds, ($body.Length -gt 300 ? $body.Substring(0,300) : $body))

            if ($status -eq 401) { throw "MusicBrainz rejected the credentials (401). Check the editor name / password." }

            # Cloudflare's spurious "400 Invalid mbid", rate limiting and gateway/server errors
            # are transient; a genuine 404 (or anything else) is thrown immediately.
            $transient = ($status -in 429, 500, 502, 503, 504) -or
                         ($status -eq 400 -and $body -match 'Invalid mbid')
            if ($transient -and $attempt -lt $script:MBMaxRequestAttempts) {
                $delay = [math]::Min(30, 4 * $attempt) + (Get-Random -Minimum 0.0 -Maximum 1.0)
                Write-Warning ("MB HTTP $status on attempt $attempt/$($script:MBMaxRequestAttempts) - retrying in {0:N1}s..." -f $delay)
                Start-Sleep -Seconds $delay
                continue
            }
            throw
        }
    }
}

function Get-MBCollection {
    <#
    .SYNOPSIS Collections. Without -Id: ALL of an editor's collections (default: the
              Connect-MB user, incl. private). With -Id (an MBID or a name): just that one —
              e.g. $library = Get-MBCollection 'library'
    .DESCRIPTION An MBID fetches directly; a name is matched exactly against the editor's
                 collections and can return several objects if the editor reuses a name.
    #>
    param(
        [Parameter(Position = 0, ValueFromPipeline)][string] $Id,
        [string] $Editor
    )
    process {
        if ($Id -match '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
            # ${} braces required: in PS7 a trailing '?' is parsed as part of the variable name
            return Invoke-MBApi -Path "collection/${Id}?fmt=json"
        }
        $own = $script:MBCredential -and (-not $Editor -or $Editor -eq $script:MBCredential.UserName)
        if (-not $Editor -and -not $own) { throw 'Pass -Editor, or authenticate with Connect-MB first.' }
        # Own collections MUST go through the auth-challenging endpoint: the public
        # editor= browse never triggers the Digest 401 handshake, so PowerShell never sends the
        # credential and PRIVATE collections stay invisible (which made sync re-create them).
        $path = if ($own) { 'collection?limit=100&fmt=json' }
                else      { "collection?editor=$([uri]::EscapeDataString($Editor))&limit=100&fmt=json" }
        $resp = Invoke-MBApi -Path $path
        $all  = if ($resp.PSObject.Properties.Name -contains 'collections') { @($resp.collections) } else { @() }
        if ($Id) { $all | Where-Object { $_.name -eq $Id } } else { $all }
    }
}

function Get-MBCollectionRelease {
    <#
    .SYNOPSIS Every release in a release collection (full objects), paged 100/req.
    .PARAMETER Inc Optional inc= sub-query (e.g. 'artist-credits').
    #>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [string] $Inc = ''
    )
    $meta  = Get-MBCollection -Id $CollectionId
    # a failed lookup must throw, not silently look like an empty collection (a full mirror
    # would otherwise treat every existing entry as removable)
    if (-not $meta -or $null -eq $meta.'release-count') { throw "Could not read collection $CollectionId (no release-count)." }
    $total = [int]$meta.'release-count'
    $limit = 100; $offset = 0
    while ($offset -lt $total) {
        $q = "release?collection=$CollectionId&limit=$limit&offset=$offset&fmt=json"
        if ($Inc) { $q += "&inc=$Inc" }
        $page = Invoke-MBApi -Path $q
        $batch = @($page.releases)
        if ($batch.Count -eq 0) { break }
        $batch
        $offset += $limit
    }
}

function Add-MBCollectionRelease {
    <#.SYNOPSIS Add releases to a collection (batched 400/req). Needs Connect-MB.#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId
    )
    Invoke-MBCollectionEdit -Method PUT -CollectionId $CollectionId -ReleaseId $ReleaseId
}

function Remove-MBCollectionRelease {
    <#.SYNOPSIS Remove releases from a collection (batched 400/req). Needs Connect-MB.#>
    param(
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId
    )
    Invoke-MBCollectionEdit -Method DELETE -CollectionId $CollectionId -ReleaseId $ReleaseId
}

function Invoke-MBCollectionEdit {
    # (internal) shared PUT/DELETE batching for the collection editors above.
    param(
        [Parameter(Mandatory)][ValidateSet('PUT', 'DELETE')][string] $Method,
        [Parameter(Mandatory)][string] $CollectionId,
        [Parameter(Mandatory)][string[]] $ReleaseId
    )
    Assert-MBConnected
    for ($i = 0; $i -lt $ReleaseId.Count; $i += 400) {
        $chunk = $ReleaseId[$i..([math]::Min($i + 399, $ReleaseId.Count - 1))]
        $list  = ($chunk -join ';')
        $null  = Invoke-MBApi -Method $Method -Path "collection/$CollectionId/releases/$list`?client=$($script:MBClient)"
    }
}

function Get-MBRelease {
    <#
    .SYNOPSIS Fetch a release by MBID. Generic lookup — pick what you need from the object
              (e.g. Get-MBRelease $id | % title).
    .PARAMETER Inc Optional inc= sub-query (e.g. 'artist-credits+labels+recordings').
    #>
    param(
        [Parameter(Mandatory, ValueFromPipeline)][string] $Id,
        [string] $Inc = ''
    )
    process {
        $q = "release/${Id}?fmt=json"
        if ($Inc) { $q += "&inc=$Inc" }
        Invoke-MBApi -Path $q
    }
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

# --- Website form automation (collection creation) --------------------------
# The WS2 API can only add/remove releases in EXISTING collections; creating one goes through
# the website's /collection/create form. These helpers log in with a cookie session, parse the
# form (fields + CSRF), and re-POST it. HTML-scraping — more brittle than WS2, kept separate.

$script:MBWebSession = $null

function ConvertFrom-MBForm {
    # (internal) Extract a form's field name/value map from HTML. The form is selected by
    # $ActionMatch against its action attribute, or — for forms with no action (they post to
    # self) — by $FieldMarker, a regex the form's BODY must match (e.g. a known field name).
    # Reads inputs (hidden/text/checked boxes), textareas, and selects (selected/first option).
    param([string] $Html, [string] $ActionMatch, [string] $FieldMarker)
    $scope = $null
    if ($ActionMatch) {
        $fm = [regex]::Match($Html, "<form[^>]*action=""[^""]*$([regex]::Escape($ActionMatch))[^""]*""[\s\S]*?</form>", 'IgnoreCase')
        if ($fm.Success) { $scope = $fm.Value }
    }
    if (-not $scope -and $FieldMarker) {
        foreach ($fm in [regex]::Matches($Html, '<form\b[\s\S]*?</form>', 'IgnoreCase')) {
            if ($fm.Value -match $FieldMarker) { $scope = $fm.Value; break }
        }
    }
    if (-not $scope) { $scope = $Html }
    $fields = [ordered]@{}

    foreach ($m in [regex]::Matches($scope, '<input\b[^>]*>', 'IgnoreCase')) {
        $tag  = $m.Value
        $name = ([regex]::Match($tag, 'name="([^"]*)"', 'IgnoreCase')).Groups[1].Value
        if (-not $name) { continue }
        $type = ([regex]::Match($tag, 'type="([^"]*)"', 'IgnoreCase')).Groups[1].Value.ToLower()
        $val  = ([regex]::Match($tag, 'value="([^"]*)"', 'IgnoreCase')).Groups[1].Value
        if ($type -in 'checkbox', 'radio') { if ($tag -notmatch '\bchecked\b') { continue } }
        if ($type -eq 'submit') { continue }
        $fields[$name] = [System.Net.WebUtility]::HtmlDecode($val)
    }
    foreach ($m in [regex]::Matches($scope, '<textarea\b[^>]*>([\s\S]*?)</textarea>', 'IgnoreCase')) {
        $name = ([regex]::Match($m.Value, 'name="([^"]*)"', 'IgnoreCase')).Groups[1].Value
        if ($name) { $fields[$name] = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) }
    }
    foreach ($m in [regex]::Matches($scope, '<select\b[^>]*name="([^"]*)"[\s\S]*?</select>', 'IgnoreCase')) {
        $name = $m.Groups[1].Value
        $sel  = [regex]::Match($m.Value, '<option[^>]*\bselected\b[^>]*value="([^"]*)"', 'IgnoreCase')
        if (-not $sel.Success) { $sel = [regex]::Match($m.Value, '<option[^>]*value="([^"]*)"', 'IgnoreCase') }
        if ($sel.Success) { $fields[$name] = [System.Net.WebUtility]::HtmlDecode($sel.Groups[1].Value) }
    }
    return $fields
}

function Get-MBFormSelectOptions {
    # (internal) All {Value, Text} options of the <select> named like *$NameSuffix in $Html.
    param([string] $Html, [string] $NameSuffix)
    $sel = [regex]::Match($Html, "<select\b[^>]*name=""[^""]*$([regex]::Escape($NameSuffix))""[\s\S]*?</select>", 'IgnoreCase')
    if (-not $sel.Success) { return @() }
    foreach ($o in [regex]::Matches($sel.Value, '<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)</option>', 'IgnoreCase')) {
        [pscustomobject]@{
            Value = [System.Net.WebUtility]::HtmlDecode($o.Groups[1].Value)
            Text  = [System.Net.WebUtility]::HtmlDecode(($o.Groups[2].Value -replace '<[^>]+>', '')).Trim()
        }
    }
}

function Get-MBPageTitle {
    # (internal) <title> of an HTML page — for diagnostics when a form isn't where expected.
    param([string] $Html)
    [System.Net.WebUtility]::HtmlDecode(([regex]::Match($Html, '<title>([^<]*)</title>').Groups[1].Value))
}

function Connect-MBWebsite {
    <#.SYNOPSIS Log into musicbrainz.org (cookie session) for form-based edits. Uses the Connect-MB credential.#>
    param()
    Assert-MBConnected
    $Credential = $script:MBCredential
    if ($script:MBWebSession) { return $script:MBWebSession }
    Write-Verbose "MBWeb -> GET $script:MBServer/login + POST (user=$($Credential.UserName))"
    $ua = @{ 'User-Agent' = $script:MBUserAgent; 'Cache-Control' = 'no-cache' }
    $login = Invoke-WebRequest -Uri "$script:MBServer/login?_=$([datetime]::UtcNow.Ticks)" -SessionVariable s -Headers $ua -UseBasicParsing
    $form  = ConvertFrom-MBForm -Html $login.Content -ActionMatch '/login'
    if (-not $form.Contains('csrf_token')) { throw "Login page carried no csrf_token (fields: $($form.Keys -join ', ')) - cached/unexpected page?" }
    $form['username']    = $Credential.UserName
    $form['password']    = $Credential.GetNetworkCredential().Password
    $form['remember_me'] = '1'
    # browser-like headers — a bare POST can trip bot protection that a GET does not
    $post = $ua + @{ 'Referer' = "$script:MBServer/login"; 'Origin' = $script:MBServer; 'Accept' = 'text/html,application/xhtml+xml' }
    # DON'T follow the login redirect: MB rotates the session cookie on the success-302, and
    # the auto-followed hop swallows that Set-Cookie — the jar keeps the stale pre-login id
    # and every later request renders logged-out. Taking the 302 directly stores the cookie.
    $resp = Invoke-WebRequest -Uri "$script:MBServer/login" -Method POST -Body $form `
                -WebSession $s -Headers $post -UseBasicParsing -MaximumRedirection 0 -SkipHttpErrorCheck
    Write-Verbose ("MBWeb <- login POST: HTTP {0}, redirect to '{1}'" -f [int]$resp.StatusCode, ([string]$resp.Headers['Location']))
    # Don't judge the auto-followed redirect: its hop can outrun the freshly set session
    # cookie and render logged-out (seen in the field: landing on /user/<name> yet the
    # /logout check failing). Verify with a NEW request instead — by now the cookie is in
    # the session jar, so a logged-in page must carry the /logout menu link.
    $check = $null
    try {
        $check = Invoke-WebRequest -Uri "$script:MBServer/user/$([uri]::EscapeDataString($Credential.UserName))?_=$([datetime]::UtcNow.Ticks)" `
                    -WebSession $s -Headers $ua -UseBasicParsing
    } catch { }   # e.g. 404 for a nonexistent editor — handled below with MB's own error
    if (-not $check -or $check.Content -notmatch 'href="/logout"') {
        $err = ([regex]::Matches($resp.Content, '<(?:p|div|span)[^>]*class="[^"]*error[^"]*"[^>]*>([\s\S]*?)</(?:p|div|span)>') |
                ForEach-Object { ($_.Groups[1].Value -replace '<[^>]+>', '').Trim() }) -join ' | '
        $finalUrl = ''; try { $finalUrl = [string]$resp.BaseResponse.RequestMessage.RequestUri } catch { }
        Write-Verbose ("MBWeb <- login response: url='{0}' title='{1}'; verification page title='{2}'" -f $finalUrl, (Get-MBPageTitle $resp.Content), ($check ? (Get-MBPageTitle $check.Content) : '(request failed)'))
        throw "MusicBrainz website login failed for '$($Credential.UserName)'$(if ($err) { ": $err" }) (post landed on: '$(Get-MBPageTitle $resp.Content)', $finalUrl)."
    }
    Write-Verbose 'MBWeb <- login OK (verified: logout link present on a fresh request)'
    $script:MBWebSession = $s
    return $s
}

function New-MBCollection {
    <#
    .SYNOPSIS Create a MusicBrainz collection via the website form. Returns the new MBID.
              Needs Connect-MB (the same credential logs into the website).
    .PARAMETER Name        Collection name.
    .PARAMETER Type        Collection type by label, e.g. 'Release', 'Owned music', 'Wishlist'.
    .PARAMETER Description Optional description.
    #>
    param(
        [Parameter(Mandatory)][string] $Name,
        [string] $Type = 'Release',
        [string] $Description = ''
    )
    Assert-MBConnected
    $s   = Connect-MBWebsite
    $ua  = @{ 'User-Agent' = $script:MBUserAgent; 'Cache-Control' = 'no-cache' }
    $url = "$script:MBServer/collection/create"
    $page = Invoke-WebRequest -Uri "$url`?_=$([datetime]::UtcNow.Ticks)" -WebSession $s -Headers $ua -UseBasicParsing
    # the create form posts to self (no action attribute) — select it by its field names
    $form = ConvertFrom-MBForm -Html $page.Content -ActionMatch '/collection/create' -FieldMarker 'name="edit-list\.'
    if ($form.Count -eq 0) { throw "Could not read the collection create form (login expired? page: '$(Get-MBPageTitle $page.Content)')." }

    $nameKey = @($form.Keys | Where-Object { $_ -match '\.name$' })[0]
    $typeKey = @($form.Keys | Where-Object { $_ -match '\.type_id$' })[0]
    $descKey = @($form.Keys | Where-Object { $_ -match '\.description$' })[0]
    if (-not $nameKey -or -not $typeKey) { throw "Unexpected create-form fields: $($form.Keys -join ', ')" }

    # Resolve the requested type LABEL to its option id. Option texts read "Release collection",
    # "Owned music", "Wishlist", ... — accept the exact label or "<Type> collection".
    $opts  = @(Get-MBFormSelectOptions -Html $page.Content -NameSuffix '.type_id')
    $match = @($opts | Where-Object { $_.Text -ieq $Type -or $_.Text -ieq "$Type collection" })
    if ($match.Count -eq 0) { throw "Collection type '$Type' not found. Available: $(($opts | ForEach-Object Text) -join ', ')" }
    $form[$typeKey] = $match[0].Value
    $form[$nameKey] = $Name
    if ($descKey) { $form[$descKey] = $Description }

    Write-Verbose "MBWeb -> POST $url (create collection '$Name')"
    $resp = Invoke-WebRequest -Uri $url -Method POST -Body $form -WebSession $s -Headers $ua -UseBasicParsing -MaximumRedirection 5
    # success redirects to /collection/<mbid>
    $final = ''
    try { $final = [string]$resp.BaseResponse.RequestMessage.RequestUri } catch { }
    $m = [regex]::Match($final, '/collection/([0-9a-fA-F-]{36})')
    if ($m.Success) { return $m.Groups[1].Value.ToLower() }
    # fallback: look the name up via the API
    $col = Get-MBCollection $Name | Select-Object -First 1
    if ($col) { return ([string]$col.id).ToLower() }
    throw "Collection creation for '$Name' did not return a collection page (form rejected?)."
}

function Set-MBCollection {
    <#
    .SYNOPSIS Edit a collection's name and/or description via the website edit form; every
              other field (type, privacy, collaborators) is preserved. Needs Connect-MB.
    .PARAMETER Id          The collection, as an MBID or a (unique) name.
    .PARAMETER Name        New collection name (omit to keep).
    .PARAMETER Description New description (omit to keep; empty string clears it).
    #>
    param(
        [Parameter(Mandatory, Position = 0)][string] $Id,
        [string] $Name,
        [string] $Description
    )
    Assert-MBConnected
    if ($Id -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        $col = @(Get-MBCollection $Id)
        if ($col.Count -ne 1) { throw "Collection '$Id' resolves to $($col.Count) collections." }
        $Id = $col[0].id
    }
    $s   = Connect-MBWebsite
    $ua  = @{ 'User-Agent' = $script:MBUserAgent; 'Cache-Control' = 'no-cache' }
    # the details form is on the "Edit" TAB (/own_collection/edit); plain /edit is the
    # release-removal view and carries no edit-list fields
    $url = "$script:MBServer/collection/$Id/own_collection/edit"
    Write-Verbose "MBWeb -> GET $url (read edit form)"
    $page = Invoke-WebRequest -Uri "$url`?_=$([datetime]::UtcNow.Ticks)" -WebSession $s -Headers $ua -UseBasicParsing
    $form = ConvertFrom-MBForm -Html $page.Content -ActionMatch '/own_collection/edit' -FieldMarker 'name="edit-list\.'
    if ($form.Count -eq 0) { throw "Could not read the edit form for collection $Id (is it yours? page: '$(Get-MBPageTitle $page.Content)')." }

    $nameKey = @($form.Keys | Where-Object { $_ -match '\.name$' })[0]
    $descKey = @($form.Keys | Where-Object { $_ -match '\.description$' })[0]
    if ($PSBoundParameters.ContainsKey('Name')) {
        if (-not $nameKey) { throw 'No name field on the collection edit form.' }
        $form[$nameKey] = $Name
    }
    if ($PSBoundParameters.ContainsKey('Description')) {
        if (-not $descKey) { throw 'No description field on the collection edit form.' }
        $form[$descKey] = $Description
    }
    Write-Verbose "MBWeb -> POST $url (update collection details)"
    $null = Invoke-WebRequest -Uri $url -Method POST -Body $form -WebSession $s -Headers $ua -UseBasicParsing -MaximumRedirection 5
}

Export-ModuleMember -Function `
    Connect-MB, Set-MBUserAgent, Set-MBClient, Set-MBServer, Invoke-MBApi, `
    Get-MBCollection, Get-MBCollectionRelease, Add-MBCollectionRelease, `
    Remove-MBCollectionRelease, Get-MBRelease, Initialize-MBTagLib, Get-MBReleaseIdFromFile, `
    Connect-MBWebsite, New-MBCollection, Set-MBCollection
