


def process_compiler(api, album, metadata, track, release):
    """
    Reads the 'release' level relationships and extracts any artist
    credited with the role 'compiler', then writes them (semicolon-joined)
    into the 'compiler' metadata field.
    """
    compilers = []

    # release is the raw JSON dict returned by the MusicBrainz API
    relations = release.get("relations", [])

    for relation in relations:
        # The relationship type we want is exactly "compiler"
        if relation.get("type", "").lower() != "compiler":
            continue

        # Each relation of type artist has an "artist" sub-dict
        artist = relation.get("artist")
        if not artist:
            continue

        # Prefer the credited name if present, fall back to canonical name
        name = relation.get("artist-credit-phrase") or artist.get("name", "")
        if name:
            compilers.append(name)

    if compilers:
        metadata["compiler"] = "; ".join(compilers)
        api.logger.debug(
            "%s: set compiler to: %s",
            "Compiler",
            metadata["compiler"],
        )
    else:
        # Clear any stale value from a previous lookup
        if "compiler" in metadata:
            del metadata["compiler"]


def enable(api):
    api.register_track_metadata_processor(process_compiler)