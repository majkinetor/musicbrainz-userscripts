# collection_sync

Mirror local music folders into [MusicBrainz collections](https://musicbrainz.org/doc/Collections).

For every configured collection the script walks the folder tree, reads each release's MBID
from its audio tags (`MUSICBRAINZ_ALBUMID`, as written by [Picard](https://picard.musicbrainz.org/)),
and makes the MusicBrainz collection match the folder exactly — releases found on disk are
**added**, collection entries with no folder are **removed**. Everything it does is printed.
It runs once and exits, so it drops straight into Task Scheduler.

## Config

`collection_sync.config.ps1` (next to the script; see the
[example](collection_sync.config.example.ps1)) — a PowerShell file returning a hashtable:

```powershell
@{
    collections = @(
        @{ name = 'various artists'; path = 'm:\audio\various artists' }
        @{ name = 'albums';          path = 'm:\audio\albums' }
    )
}
```

`name` is the MusicBrainz collection name (on your account), `path` the folder holding the
release folders. More options may be added over time.

## Usage

```powershell
# one time, as the user the task runs under:
Get-Credential | Export-Clixml $HOME\mb.cred

# dry run — prints the full plan, changes nothing:
.\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred) -WhatIf

# for real:
.\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred)

# also create collections that don't exist yet (private, Release type):
.\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred) -CreateMissing
```

Scheduled task action:

```
pwsh -NoProfile -File C:\...\scripts\collection_sync\collection_sync.ps1 -Credential (Import-Clixml $HOME\mb.cred)
```

## Notes

- **Auth** — a regular MusicBrainz account (`Get-Credential`: editor name + password). The
  credential file written by `Export-Clixml` is DPAPI-encrypted, readable only by the same
  Windows user on the same machine.
- **Tags pointing at merged releases** — when a release was merged on MusicBrainz after your
  files were tagged, the sync resolves the tagged MBID to its merge target automatically and
  logs a `~ ... re-tag '<folder>'` hint; refresh those folders in Picard when convenient.
- **Untagged folders** are listed as warnings and skipped — tag them with Picard to include.
- Uses the shared [MusicBrainz module](../musicbrainz/README.md) underneath; on first run it
  downloads TagLibSharp (tag reading) into `../musicbrainz/lib/`.
