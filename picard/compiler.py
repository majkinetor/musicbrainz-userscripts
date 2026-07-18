PLUGIN_NAME = "Compiler"
PLUGIN_AUTHOR = "majkinetor"
PLUGIN_DESCRIPTION = (
    "Fetches the 'compiler' relationship from MusicBrainz release data "
    "and populates the ~compiler tag. Multiple compilers are joined with ';'."
)
PLUGIN_VERSION = "1.0"
PLUGIN_API_VERSIONS = ["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"]
PLUGIN_LICENSE = "GPL-2.0"
PLUGIN_LICENSE_URL = "https://www.gnu.org/licenses/gpl-2.0.html"

from picard import log
from picard.metadata import register_track_metadata_processor


def process_compiler(album, metadata, track, release):
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
        log.debug(
            "%s: set compiler to: %s",
            PLUGIN_NAME,
            metadata["compiler"],
        )
    else:
        # Clear any stale value from a previous lookup
        if "compiler" in metadata:
            del metadata["compiler"]


register_track_metadata_processor(process_compiler)