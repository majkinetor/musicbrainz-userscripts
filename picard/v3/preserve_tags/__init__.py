# -*- coding: utf-8 -*-


PRESERVE_TAG_FIELD = "preserve_tags"


def parse_tag_list(api, value):
    api.logger.debug("[PreserveTags] parse_tag_list: enter, value=%r", value)
    if not value:
        api.logger.debug("[PreserveTags] parse_tag_list: exit, empty -> []")
        return []
    result = [p.strip().lower() for p in value.replace(",", " ").split() if p.strip()]
    api.logger.debug("[PreserveTags] parse_tag_list: exit, result=%s", result)
    return result


def read_mutagen_tags(api, file):
    """
    Read tags directly from disk via mutagen.
    Returns {lowercase_key: [str_values]} — ground truth for what is on disk.
    """
    api.logger.debug("[PreserveTags] read_mutagen_tags: enter, file=%s", file.filename)
    try:
        import mutagen
        mf = mutagen.File(file.filename)
        if mf is None:
            api.logger.debug("[PreserveTags] read_mutagen_tags: exit, mutagen could not open file")
            return {}
        raw = {k.lower(): [str(v) for v in (val if isinstance(val, list) else [val])]
               for k, val in mf.tags.items()}
        api.logger.debug("[PreserveTags] read_mutagen_tags: exit, keys=%s", sorted(raw.keys()))
        return raw
    except Exception as e:
        api.logger.debug("[PreserveTags] read_mutagen_tags: exit, error=%s", e)
        return {}


def preserve_tags_processor(api, track, file):
    api.logger.debug("[PreserveTags] preserve_tags_processor: enter, file=%s", file.filename)

    orig = file.orig_metadata
    preserve_raw = orig.get(PRESERVE_TAG_FIELD, "")
    tags_to_preserve = parse_tag_list(api, preserve_raw)

    if not tags_to_preserve:
        api.logger.debug("[PreserveTags] preserve_tags_processor: exit, no '%s' tag, skipping", PRESERVE_TAG_FIELD)
        return

    tags_to_preserve.append(PRESERVE_TAG_FIELD)
    api.logger.debug("[PreserveTags] preserve_tags_processor: tags=%s", tags_to_preserve)

    # Mutagen is the single source of truth — no Picard-computed fields
    mutagen_tags = read_mutagen_tags(api, file)

    restored, deleted = [], []

    for picard_tag in tags_to_preserve:
        api.logger.debug("[PreserveTags] preserve_tags_processor: checking '%s'", picard_tag)
        values = mutagen_tags.get(picard_tag)
        if values:
            # Tag exists on disk — restore original value
            file.metadata.delete(picard_tag)
            for v in values:
                file.metadata.add(picard_tag, v)
            restored.append(picard_tag)
            api.logger.debug(
                "[PreserveTags] preserve_tags_processor: restored '%s' = %s",
                picard_tag, values,
            )
        else:
            # Tag absent on disk — delete whatever MusicBrainz wrote
            file.metadata.delete(picard_tag)
            deleted.append(picard_tag)
            api.logger.debug(
                "[PreserveTags] preserve_tags_processor: deleted '%s' (not found in mutagen)",
                picard_tag,
            )

    api.logger.debug(
        "[PreserveTags] preserve_tags_processor: exit, file=%s restored=%s deleted=%s",
        file.filename, restored, deleted,
    )


def enable(api):
    api.register_file_post_addition_to_track_processor(preserve_tags_processor)