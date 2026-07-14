# collection_sync config — copy to collection_sync.config.ps1 and edit for your library.
# A .ps1 returning a hashtable; more options may be added over time.
#   collections : list of MusicBrainz release collections to mirror, each
#                 @{ name = '<collection name>'; path = '<folder with releases>' }
@{
    collections = @(
        @{ name = 'various artists'; path = 'm:\audio\various artists' }
        @{ name = 'albums';          path = 'm:\audio\albums' }
    )
}
