# -*- coding: utf-8 -*-
PLUGIN_NAME = "Preserve Tags"
PLUGIN_AUTHOR = "majkinetor"
PLUGIN_DESCRIPTION = """
Reads a `preserve_tags` tag from your FLAC file (space- or comma-separated
list of Picard internal tag names) and protects those tags after MusicBrainz
tagging using the following logic:

  - If the tag EXISTS on disk   -> restore the original value
  - If the tag is ABSENT on disk -> delete it (prevent MusicBrainz from writing it)

Tag presence is determined by reading the file directly via mutagen, so Picard
internal/computed fields (like ~albumartists) are never mistaken for real tags.

Example — add this tag to your audio file:
  preserve_tags = album albumartist albumartistsort

The `preserve_tags` tag itself is always protected automatically.
"""
PLUGIN_VERSION = "2.1"
PLUGIN_API_VERSIONS = ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"]
PLUGIN_LICENSE = "GPL-2.0-or-later"
PLUGIN_LICENSE_URL = "https://www.gnu.org/licenses/gpl-2.0.html"

from picard import log
from picard.file import register_file_post_addition_to_track_processor

PRESERVE_TAG_FIELD = "preserve_tags"


def parse_tag_list(value):
    log.debug("[PreserveTags] parse_tag_list: enter, value=%r", value)
    if not value:
        log.debug("[PreserveTags] parse_tag_list: exit, empty -> []")
        return []
    result = [p.strip().lower() for p in value.replace(",", " ").split() if p.strip()]
    log.debug("[PreserveTags] parse_tag_list: exit, result=%s", result)
    return result


def read_mutagen_tags(file):
    """
    Read tags directly from disk via mutagen.
    Returns {lowercase_key: [str_values]} — ground truth for what is on disk.
    """
    log.debug("[PreserveTags] read_mutagen_tags: enter, file=%s", file.filename)
    try:
        import mutagen
        mf = mutagen.File(file.filename)
        if mf is None:
            log.debug("[PreserveTags] read_mutagen_tags: exit, mutagen could not open file")
            return {}
        raw = {k.lower(): [str(v) for v in (val if isinstance(val, list) else [val])]
               for k, val in mf.tags.items()}
        log.debug("[PreserveTags] read_mutagen_tags: exit, keys=%s", sorted(raw.keys()))
        return raw
    except Exception as e:
        log.debug("[PreserveTags] read_mutagen_tags: exit, error=%s", e)
        return {}


def preserve_tags_processor(track, file):
    log.debug("[PreserveTags] preserve_tags_processor: enter, file=%s", file.filename)

    orig = file.orig_metadata
    preserve_raw = orig.get(PRESERVE_TAG_FIELD, "")
    tags_to_preserve = parse_tag_list(preserve_raw)

    if not tags_to_preserve:
        log.debug("[PreserveTags] preserve_tags_processor: exit, no '%s' tag, skipping", PRESERVE_TAG_FIELD)
        return

    tags_to_preserve.append(PRESERVE_TAG_FIELD)
    log.debug("[PreserveTags] preserve_tags_processor: tags=%s", tags_to_preserve)

    # Mutagen is the single source of truth — no Picard-computed fields
    mutagen_tags = read_mutagen_tags(file)

    restored, deleted = [], []

    for picard_tag in tags_to_preserve:
        log.debug("[PreserveTags] preserve_tags_processor: checking '%s'", picard_tag)
        values = mutagen_tags.get(picard_tag)
        if values:
            # Tag exists on disk — restore original value
            file.metadata.delete(picard_tag)
            for v in values:
                file.metadata.add(picard_tag, v)
            restored.append(picard_tag)
            log.debug(
                "[PreserveTags] preserve_tags_processor: restored '%s' = %s",
                picard_tag, values,
            )
        else:
            # Tag absent on disk — delete whatever MusicBrainz wrote
            file.metadata.delete(picard_tag)
            deleted.append(picard_tag)
            log.debug(
                "[PreserveTags] preserve_tags_processor: deleted '%s' (not found in mutagen)",
                picard_tag,
            )

    log.debug(
        "[PreserveTags] preserve_tags_processor: exit, file=%s restored=%s deleted=%s",
        file.filename, restored, deleted,
    )


register_file_post_addition_to_track_processor(preserve_tags_processor)