# -*- coding: utf-8 -*-
PLUGIN_NAME = "Discogs Info"
PLUGIN_AUTHOR = "majkinetor"
PLUGIN_DESCRIPTION = "Fetch and merge Discogs genres + styles into discogs_genre (album-level, cached) + store Discogs IDs"
PLUGIN_VERSION = "1.4"
PLUGIN_API_VERSIONS = ["2.0"]

import re
import json
from urllib.request import Request, urlopen
from picard import log
from picard.metadata import register_album_metadata_processor

USER_AGENT = "PicardDiscogsGenreStylePlugin/1.4"

# Global cache (process lifetime)
cache = {}

# Matches:
# /release/123
# /releases/123
# /master/456
discogs_regex = re.compile(r"discogs\.com/(release|releases|master)/(\d+)")

# ----------------------------
# Discogs API fetch
# ----------------------------
def fetch_discogs_data(entity_type, discogs_id):
    try:
        if entity_type in ("release", "releases"):
            url = f"https://api.discogs.com/releases/{discogs_id}"
        elif entity_type == "master":
            url = f"https://api.discogs.com/masters/{discogs_id}"
        else:
            return [], []

        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))

        genres = data.get("genres", [])
        styles = data.get("styles", [])

        return genres, styles

    except Exception as e:
        log.error(f"Discogs fetch failed for {entity_type}/{discogs_id}: {e}")
        return [], []

# ----------------------------
# Extract Discogs ID from MB relations
# ----------------------------
def extract_discogs_info(relations):
    if not relations:
        return None, None

    for rel in relations:
        if rel.get("target-type") != "url":
            continue

        url_data = rel.get("url")
        if not url_data:
            continue

        url = url_data.get("resource", "")
        match = discogs_regex.search(url)

        if match:
            return match.group(1), match.group(2)

    return None, None

# ----------------------------
# Extract BOTH release + master IDs
# ----------------------------
def get_discogs_ids(release):
    release_id = None
    master_id = None

    if not release:
        return None, None

    # Prefer release-group (master)
    rg = release.get("release-group")
    if rg:
        entity_type, discogs_id = extract_discogs_info(rg.get("relations"))
        if entity_type == "master":
            master_id = discogs_id

    # Release-level ID
    entity_type, discogs_id = extract_discogs_info(release.get("relations"))
    if entity_type in ("release", "releases"):
        release_id = discogs_id

    return release_id, master_id

# ----------------------------
# Main album processor
# ----------------------------
def process_album(album, metadata, release):
    release_id, master_id = get_discogs_ids(release)

    # Decide which ID to use for fetching genres/styles
    if master_id:
        entity_type = "master"
        discogs_id = master_id
    elif release_id:
        entity_type = "release"
        discogs_id = release_id
    else:
        return

    cache_key = f"{entity_type}:{discogs_id}"

    if cache_key in cache:
        genres, styles = cache[cache_key]
    else:
        genres, styles = fetch_discogs_data(entity_type, discogs_id)
        cache[cache_key] = (genres, styles)

    if not genres and not styles:
        return

    # Merge genres + styles
    combined = []
    if genres:
        combined.extend(genres)
    if styles:
        combined.extend(styles)

    # Deduplicate (preserve order)
    seen = set()
    combined_unique = [x for x in combined if not (x in seen or seen.add(x))]

    merged_str = ", ".join(combined_unique)

    # Album-level metadata
    metadata["discogs_genre"] = merged_str

    if release_id:
        metadata["discogs_releaseid"] = release_id
    if master_id:
        metadata["discogs_masterid"] = master_id

    # Write to file metadata
    for track in album.tracks:
        for file in track.linked_files:
            file.metadata["discogs_genre"] = merged_str

            if release_id:
                file.metadata["discogs_releaseid"] = release_id
            if master_id:
                file.metadata["discogs_masterid"] = master_id

    log.debug(
        f"Discogs release_id={release_id} master_id={master_id} "
        f"-> used {entity_type}/{discogs_id} merged={combined_unique}"
    )

# Register plugin
register_album_metadata_processor(process_album)