# collection_sync config — copy to collection_sync.config.ps1 and edit for your library.
# A .ps1 returning a hashtable; a command-line parameter always beats its config counterpart.
#   collections     : list of MusicBrainz release collections to mirror, each
#                     @{ name = '<collection name>'; path = '<folder with releases>' }
#   CreateMissing   : (optional) create a collection that doesn't exist yet, as if
#                     -CreateMissing was passed
#   CredentialsFile : (optional) saved MusicBrainz credential; created on first run
#                     (you are prompted once), then reused for unattended runs
#   ThrottleLimit   : (optional) parallel MusicBrainz workers for reads (they share one
#                     rate limit and back off together); 1 = sequential, default 4
@{
    collections     = @(
        @{ name = 'various artists'; path = 'm:\audio\various artists' }
        @{ name = 'albums';          path = 'm:\audio\albums' }
    )
    CreateMissing   = $true
    CredentialsFile = "$HOME\mb.cred"
    ThrottleLimit   = 4
}
