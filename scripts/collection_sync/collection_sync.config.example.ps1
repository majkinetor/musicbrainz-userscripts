# collection_sync config — copy to collection_sync.config.ps1 and edit for your library.
# A .ps1 returning a hashtable; a command-line parameter always beats its config counterpart.
#   collections     : list of MusicBrainz release collections to mirror, each
#                     @{ name = '<collection name>'; path = '<folder with releases>' }
#   CreateMissing   : (optional) create a collection that doesn't exist yet, as if
#                     -CreateMissing was passed
#   CredentialsFile : (optional) path to an Export-Clixml'd MusicBrainz credential,
#                     created once with:  Get-Credential | Export-Clixml "$HOME\mb.cred"
@{
    collections     = @(
        @{ name = 'various artists'; path = 'm:\audio\various artists' }
        @{ name = 'albums';          path = 'm:\audio\albums' }
    )
    CreateMissing   = $true
    CredentialsFile = "$HOME\mb.cred"
}
