# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## Providers

### YouTube Music

A search for an ISRC YouTube Music doesn't know brings up unrelated songs instead of nothing, and labels sometimes reuse an ISRC for another version of a song with the same title and length: [JP92Q2400507](https://musicbrainz.org/isrc/JP92Q2400507) is both *メズマライザー* and its *Critical Damage ver.* Hence the strict search. The album's tracklist is read from its own playlist, because its album page, seen without logging in, shows a track's music video in its place. The edit note names the album because a song's URL stops saying which album it was on once it is delisted.

### Amazon Music

Amazon Music has no ISRC search, so only a linked album gives links. It is read as a guest, through the catalogue its web player uses.

### 7digital

Read through the catalogue its web store uses. It can't list an album's tracks, so each track is searched by its title, with the album's title and then with its artist, and the hits from the linked album are kept, each with its ISRC, disc and position. One search often brings up the whole album; when it doesn't, there is a search per track, a few at a time.

### Spotify

Spotify's own ISRC API needs a paid developer account, so the ISRCs come through a service that looks them up with its own credentials. molla returns the album's ISRCs in album order; unmatched tracks stay empty.

### Beatport

Beatport is behind Cloudflare, so it can't be fetched from MusicBrainz. The script also runs on `beatport.com/release/*` and reads the ISRCs there; results are cached.

### Qobuz

`album/get`, the only endpoint with per-track ISRCs, answers anonymously only from countries Qobuz serves; from anywhere else it answers *404* for every album. A login lends its account's region. Platform Check keeps the token, and ISRC Scout and Credit Hoarder read it. Qobuz rate-limits hard, and a barcode search needs the 13-digit, zero-padded EAN.

### Batches

SoundExchange is searched 30 tracks at a time; Deezer, a request per track, 50 at a time. A click on a *Not searched* row continues.
