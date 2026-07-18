# Picard plugins

Plugins for [MusicBrainz Picard](https://picard.musicbrainz.org/) used alongside the userscripts in this repo.

**Install**: copy the `.py` file into Picard's plugin folder (*Options → Plugins → Open plugin folder*, or `%LOCALAPPDATA%\MusicBrainz\Picard\plugins` on Windows), then enable it in *Options → Plugins* and restart Picard.

| Plugin | File | What it does |
| ------ | ---- | ------------ |
| **Release Relations Tagger** | [`relationships.py`](relationships.py) | Maps MB **release-level relationships** (artist, label, place, area, URL) to configurable tag fields — each type can be enabled, renamed and prefixed; multiple values join with a configurable separator. Place/area rels are fetched via a supplementary API call (Picard's default lookup omits them). Configured in *Options → Plugins*. |
| **Bandcamp Info** | [`bandcamp_info.py`](bandcamp_info.py) | Fetches the release's **Bandcamp tags and about-description** from the linked Bandcamp page into configurable tag names (album-level, cached). |
| **Discogs Info** | [`discogs_info.py`](discogs_info.py) | Fetches and merges **Discogs genres + styles** into a `discogs_genre` tag (album-level, cached) and stores the Discogs release/master IDs. |
| **Preserve Tags** | [`preserve_tags.py`](preserve_tags.py) | Protects tags listed in a per-file `preserve_tags` tag from being overwritten by MB tagging: values present on disk are restored, absent ones are kept absent. Presence is checked by reading the file via mutagen, so Picard-internal fields are never mistaken for real tags. |
| **Compiler** | [`compiler.py`](compiler.py) | Extracts the release's **compiler** relationship from MB and writes it to a `compiler` tag (multiple compilers joined with `;`). |
| **timestamp** | [`timestamp.py`](timestamp.py) | Adds a `$timestamp()` tagger-script function returning the current date-time (`YYYY-MM-DD HH:MM`). |
