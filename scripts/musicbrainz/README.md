# MusicBrainz PowerShell module

General-purpose [MusicBrainz](https://musicbrainz.org) helpers for PowerShell — a standalone
module with no ties to any particular script, equally usable for interactive exploration:

```powershell
Import-Module .\MusicBrainz.psm1
Connect-MB                                    # prompts, verifies, remembers
Get-MBUserCollection                          # your collections (incl. private)
(Get-MBCollection 'library').id               # collection by name → MBID
Get-MBCollectionRelease (Get-MBCollection 'library').id | % title
```

## Functions

| Function | What it does |
|---|---|
| `Connect-MB` | Authenticate once (prompts if no `-Credential`); verified against the API and held module-wide — no other function takes a credential |
| `Invoke-MBApi` | Low-level `/ws/2` request: throttled (~1 req/s), retry with backoff on transient errors, persisted session; `GET`/`PUT`/`DELETE` |
| `Get-MBUserCollection` | List an editor's collections — your own (default, incl. private) or `-Editor <name>` (public) |
| `Get-MBCollection` | One collection, by MBID **or by name** |
| `Get-MBCollectionRelease` | Every release in a release collection (full objects, paged; optional `-Inc`) |
| `Add-MBCollectionRelease` / `Remove-MBCollectionRelease` | Edit a release collection (batched 400/request) |
| `New-MBCollection` | Create a collection (`-Type 'Release'` by default). The WS2 API can't create collections, so this submits the website form with the same credential |
| `Get-MBRelease` | A release by MBID (optional `-Inc 'artist-credits+labels+…'`) |
| `Get-MBReleaseIdFromFile` | Read `MUSICBRAINZ_ALBUMID` from an audio file's tags (TagLibSharp, auto-downloaded into `lib/` on first use) |
| `Connect-MBWebsite` | Cookie login to musicbrainz.org for form-based operations (used by `New-MBCollection`) |
| `Set-MBUserAgent` / `Set-MBClient` | Identify your application (User-Agent header / the `client=` id MB records on collection edits) |

## Notes

- **Rate limiting** — all API calls funnel through one throttle (min 1.1 s spacing) and retry
  transient failures (429/5xx and Cloudflare's spurious `400 Invalid mbid` streaks) with
  backoff for up to ~5 minutes.
- **Auth** — HTTP Digest with a regular MusicBrainz account; the `[pscredential]` UserName is
  the editor name. Your own private collections are only visible through the authenticated
  path, which `Connect-MB` enables.
- **PS7 gotcha** encoded in the source: `"$var?query"` parses `?` into the variable name —
  interpolated URLs use `${var}` braces.

Used by [collection_sync](../collection_sync/README.md).
