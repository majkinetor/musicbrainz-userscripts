# -*- coding: utf-8 -*-
#
# Release Relations Tagger — MusicBrainz Picard Plugin
#
# Reads release-level relationships from MusicBrainz and writes them into
# configurable tag fields. Covers five relationship entity types:
#
#   Artist → https://musicbrainz.org/relationships/artist-release
#   Label  → https://musicbrainz.org/relationships/label-release
#   Place  → https://musicbrainz.org/relationships/place-release
#   Area   → https://musicbrainz.org/relationships/area-release
#   URL    → https://musicbrainz.org/relationships/release-url
#
# Picard's default release API request includes artist-rels, label-rels,
# url-rels but NOT place-rels or area-rels. This plugin issues a separate
# supplementary API call per release to fetch those two missing rel types and
# merges them into the same relations list before processing.
#
# Each relationship type can be individually enabled/disabled and mapped to
# any tag name. A global prefix (e.g. "ar_") is prepended to every tag name.
# Multiple values are joined with the configured separator.
#
# Relationships already handled natively by Picard are DISABLED by default.
# Re-enable them to override Picard's field with a custom name or prefix.
# When an enabled relationship writes to a different tag than Picard's native
# one, the native tag is automatically deleted to avoid duplicates.
#
# Configure via Options → Plugins → Release Relations Tagger.

PLUGIN_NAME = "Release Relations Tagger"
PLUGIN_AUTHOR = "majkinetor"
PLUGIN_DESCRIPTION = (
    "Maps MusicBrainz release-level relationships to configurable tag fields. "
    "Covers artist, label, place, area and URL relationship types. "
    "Place and area relations are fetched via a supplementary API call since "
    "Picard does not include them in its default release lookup. "
    "Each type can be individually enabled, renamed and prefixed. "
    "Multiple values are joined with a configurable separator. "
    "MB references: "
    "Artist https://musicbrainz.org/relationships/artist-release | "
    "Label https://musicbrainz.org/relationships/label-release | "
    "Place https://musicbrainz.org/relationships/place-release | "
    "Area https://musicbrainz.org/relationships/area-release | "
    "URL https://musicbrainz.org/relationships/release-url"
)
PLUGIN_VERSION = "2.0"
PLUGIN_API_VERSIONS = [
    "2.0", "2.1", "2.2", "2.3", "2.4", "2.5",
    "2.6", "2.7", "2.8", "2.9",
]
PLUGIN_LICENSE = "GPL-2.0"
PLUGIN_LICENSE_URL = "https://www.gnu.org/licenses/gpl-2.0.html"

# ---------------------------------------------------------------------------
# Relationship catalogues
#
# Tuple: (mb_relation_type, config_suffix, default_tag, enabled_by_default, note)
#
# Suffixes must be globally unique across all catalogues (shared config space).
# Values extracted per entity type:
#   artist → artist["name"] (or credited name from target-credit/source-credit)
#   label  → label["name"]  (or credited name)
#   place  → place["name"]
#   area   → area["name"]
#   url    → url["resource"]
# ---------------------------------------------------------------------------

_ARTIST_RELATIONS = [
    # ── Not handled natively by Picard ────────────────────────────────
    ("compiler",            "a_compiler",       "compiler",              True,
     "Person who compiled the release (e.g. a compilation album editor)."),

    ("arranger",            "a_arranger",       "arranger",              True,
     "General arranger credit at the release level."),

    ("instrument arranger", "a_inst_arranger",  "arranger",              True,
     "Arranged specific instruments. Merged into 'arranger' by default."),

    ("vocal arranger",      "a_vocal_arranger", "arranger",              True,
     "Arranged vocals. Merged into 'arranger' by default."),

    ("orchestrator",        "a_orchestrator",   "orchestrator",          True,
     "Person who orchestrated the release."),

    ("translator",          "a_translator",     "translator",            True,
     "Person who translated the lyrics/libretto."),

    ("recording",           "a_recording_eng",  "engineer",              True,
     "Recording engineer."),

    ("audio",               "a_audio_eng",      "engineer",              True,
     "Audio engineer (generic). Merged into 'engineer' by default."),

    ("mastering",           "a_mastering_eng",  "mastering",             True,
     "Mastering engineer."),

    ("mix",                 "a_mix_eng",        "mixer",                 True,
     "Mixing engineer (technical role, not DJ mixing)."),

    ("balance",             "a_balance_eng",    "engineer",              True,
     "Balance engineer (classical). Merged into 'engineer' by default."),

    ("sound",               "a_sound_eng",      "engineer",              True,
     "Sound engineer. Merged into 'engineer' by default."),

    ("editor",              "a_editor_eng",     "engineer",              True,
     "Editor. Merged into 'engineer' by default."),

    ("art direction",       "a_art_direction",  "artdirection",          True,
     "Art director for the release sleeve."),

    ("artwork",             "a_artwork",        "artwork",               True,
     "Generic artwork credit (deprecated in MB — prefer design/illustration, "
     "but still appears on many older releases)."),

    ("design",              "a_design",         "design",                True,
     "Designer of the release sleeve."),

    ("graphic design",      "a_graphic_design", "design",                True,
     "Graphic designer. Merged into 'design' by default."),

    ("illustration",        "a_illustration",   "illustration",          True,
     "Illustrator for the release artwork."),

    ("photography",         "a_photography",    "photographer",          True,
     "Photographer credited on the release."),

    ("booklet editor",      "a_booklet_editor", "bookleteditor",         True,
     "Editor of the physical release booklet."),

    ("liner notes",         "a_liner_notes",    "linernotes",            True,
     "Author of the liner notes."),

    ("programming",         "a_programming",    "programming",           True,
     "Programmer (e.g. drum machines, sequencing)."),

    ("production coordinator", "a_prod_coord",  "productioncoordinator", True,
     "Production coordinator for the release."),

    ("instrument technician",  "a_inst_tech",   "instrumenttechnician",  True,
     "Instrument technician, piano tuner, or similar."),

    ("creative direction",  "a_creative_dir",   "creativedirection",     True,
     "Artist who provided general creative direction/inspiration."),

    ("transferrer",         "a_transferrer",    "transferrer",           True,
     "Artist responsible for transferring the release (e.g. tape to digital)."),

    ("publisher",           "a_publisher",      "publisher",             True,
     "Publisher of the release (not the same as the record label)."),

    ("performer",           "a_performer",      "performer",             True,
     "Generic performer credit (release-level, when specific role unknown)."),

    ("instruments",         "a_instruments",    "performer",             True,
     "Artist performed instrument(s) — release-level. Merged into 'performer'."),

    ("vocal",               "a_vocal",          "performer",             True,
     "Artist performed vocals — release-level. Merged into 'performer'."),

    # ── Handled by Picard core — disabled by default ──────────────────
    ("producer",            "a_producer",       "producer",              False,
     "⚠ Picard already writes 'producer'. Enable to override with custom tag/prefix."),

    ("mix-DJ",              "a_mix_dj",         "djmixer",               False,
     "⚠ Picard already writes 'djmixer'. Enable to override with custom tag/prefix."),

    ("remixer",             "a_remixer",        "remixer",               False,
     "⚠ Picard already writes 'remixer'. Enable to override with custom tag/prefix."),

    ("conductor",           "a_conductor",      "conductor",             False,
     "⚠ Picard already writes 'conductor'. Enable to override with custom tag/prefix."),
]

_LABEL_RELATIONS = [
    ("copyright",              "l_copyright",       "copyright",          True,
     "Label holding the © copyright for this release."),

    ("phonographic copyright", "l_pcopyright",      "phonographiccopyright", True,
     "Label holding the ℗ phonographic copyright for this release."),

    ("published",              "l_published",       "releasepublisher",   True,
     "Org that published this release (not the same as the record label)."),

    ("distributed",            "l_distributed",     "distributor",        True,
     "Org that distributed this release."),

    ("manufactured",           "l_manufactured",    "manufacturer",       True,
     "Org that manufactured this release."),

    ("licensed",               "l_licensed",        "licensor",           True,
     "Org that was the licensor for this release."),

    ("marketed",               "l_marketed",        "marketedby",         True,
     "Org that marketed this release."),

    ("printed",                "l_printed",         "printedby",          True,
     "Org that printed the release sleeve/booklet."),

    ("exported",               "l_exported",        "exportedby",         False,
     "Org that exported this release (uncommon)."),

    ("glass mastered",         "l_glass_mastered",  "glassmaster",        False,
     "Company that made the glass master (physical pressing, not audio mastering)."),

    ("pressed",                "l_pressed",         "pressedby",          False,
     "Pressing company for this release (physical releases only)."),
]

_PLACE_RELATIONS = [
    ("recorded at",         "p_recorded",       "recordingplace",        True,
     "Studio or venue where the release was recorded."),

    ("mixed at",            "p_mixed",          "mixingplace",           True,
     "Studio where the release was mixed."),

    ("mastered at",         "p_mastered",       "masteringplace",        True,
     "Studio where the release was mastered."),

    ("glass mastered at",   "p_glass_mastered", "glassmasteringplace",   False,
     "Facility where the glass master was made (physical, not audio mastering)."),

    ("pressed at",          "p_pressed",        "pressingplace",         False,
     "Pressing plant where the release was pressed."),
]

_AREA_RELATIONS = [
    ("recorded in",         "ar_recorded",      "recordingarea",         True,
     "Country/area where the release was recorded."),

    ("mastered in",         "ar_mastered",      "masteringarea",         False,
     "Country/area where the release was mastered."),
]

_URL_RELATIONS = [
    # ── Functional / generic types ────────────────────────────────────
    ("license",               "u_license",        "licenseurl",            True,
     "URL of the license for this release (e.g. Creative Commons)."),

    ("free streaming",        "u_freestream",     "freestreamurl",         True,
     "Site where the release can be streamed for free (e.g. Bandcamp, YouTube)."),

    ("streaming",             "u_streaming",      "streamingurl",          True,
     "Site where the release can be streamed for a subscription fee (e.g. Tidal)."),

    ("purchase for download", "u_download",       "downloadurl",           True,
     "Site where the release can be purchased for download."),

    ("download for free",     "u_freedownload",   "freedownloadurl",       True,
     "Site where the release can be downloaded for free."),

    ("purchase for mail-order", "u_mailorder",    "mailorderurl",          True,
     "Site where the release can be purchased by mail order."),

    ("discography entry",     "u_discography",    "discographyurl",        True,
     "Discography page for this specific release."),

    ("official homepage",     "u_homepage",       "homepageurl",           False,
     "Official homepage URL for this release."),

    ("production",            "u_production",     "productionurl",         False,
     "Production page for this release."),

    # ── Database / reference sites ────────────────────────────────────
    ("discogs",               "u_discogs",        "discogsurl",            True,
     "Discogs page for this release."),

    ("asin",                  "u_asin",           "amazonurl",             True,
     "Amazon ASIN / Amazon page for this release."),

    ("allmusic",              "u_allmusic",       "allmusicurl",           False,
     "AllMusic page for this release."),

    ("secondhandsongs",       "u_secondhandsongs","secondhandsongsurl",    False,
     "SecondHandSongs page for this release."),

    ("vgmdb",                 "u_vgmdb",          "vgmdburl",              False,
     "VGMdb page for this release (video game / anime music database)."),
]

# Ordered sections for the UI tabs
_ALL_SECTIONS = [
    ("Artist",  _ARTIST_RELATIONS),
    ("Label",   _LABEL_RELATIONS),
    ("Place",   _PLACE_RELATIONS),
    ("Area",    _AREA_RELATIONS),
    ("URL",     _URL_RELATIONS),
]
_ALL_RELATIONS = [rel for _, rels in _ALL_SECTIONS for rel in rels]

# ---------------------------------------------------------------------------
# Picard-native tag mapping — artist relations only
# ---------------------------------------------------------------------------
_PICARD_NATIVE_TAG = {
    "a_producer":       "producer",
    "a_mix_dj":         "djmixer",
    "a_remixer":        "remixer",
    "a_conductor":      "conductor",
    "a_arranger":       "arranger",
    "a_inst_arranger":  "arranger",
    "a_vocal_arranger": "arranger",
    "a_orchestrator":   "arranger",
    "a_mix_eng":        "mixer",
    "a_audio_eng":      "engineer",
    "a_recording_eng":  "engineer",
    "a_mastering_eng":  "engineer",
    "a_balance_eng":    "engineer",
    "a_sound_eng":      "engineer",
    "a_editor_eng":     "engineer",
    "a_performer":      "performer:",   # sentinel: prefix match
    "a_instruments":    "performer:",
    "a_vocal":          "performer:",
}

# ---------------------------------------------------------------------------
# Config key helpers
# ---------------------------------------------------------------------------
def _enabled_key(suffix): return "rrt_enabled_{}".format(suffix)
def _tag_key(suffix):     return "rrt_tag_{}".format(suffix)
def _sep_key():           return "rrt_separator"
def _prefix_key():        return "rrt_prefix"

# ---------------------------------------------------------------------------
# Per-entity-type name extractors
# ---------------------------------------------------------------------------
def _artist_name(relation):
    artist = relation.get("artist")
    if not artist:
        return ""
    direction = relation.get("direction", "backward")
    credit = relation.get("target-credit" if direction == "backward"
                          else "source-credit", "")
    return credit or artist.get("name", "")

def _label_name(relation):
    label = relation.get("label")
    if not label:
        return ""
    direction = relation.get("direction", "backward")
    credit = relation.get("target-credit" if direction == "backward"
                          else "source-credit", "")
    return credit or label.get("name", "")

def _place_name(relation):
    place = relation.get("place")
    return place.get("name", "") if place else ""

def _area_name(relation):
    area = relation.get("area")
    return area.get("name", "") if area else ""

def _url_value(relation):
    url = relation.get("url")
    return url.get("resource", "") if url else ""

# Maps target-type → (name extractor, {mb_type → config_suffix})
_TARGET_HANDLERS = {
    "artist": (_artist_name, {mb: s for mb, s, *_ in _ARTIST_RELATIONS}),
    "label":  (_label_name,  {mb: s for mb, s, *_ in _LABEL_RELATIONS}),
    "place":  (_place_name,  {mb: s for mb, s, *_ in _PLACE_RELATIONS}),
    "area":   (_area_name,   {mb: s for mb, s, *_ in _AREA_RELATIONS}),
    "url":    (_url_value,   {mb: s for mb, s, *_ in _URL_RELATIONS}),
}

# ---------------------------------------------------------------------------
# Options page — tabbed UI, one tab per entity type
# ---------------------------------------------------------------------------
from PyQt5 import QtWidgets
from picard import config, log
from picard.metadata import (
    register_album_metadata_processor,
    register_track_metadata_processor,
)
from picard.plugin import PluginPriority
from picard.ui.options import OptionsPage, register_options_page


class ReleaseRelationsOptionsPage(OptionsPage):
    NAME = "release_relations_tagger"
    TITLE = "Release Relations Tagger"
    PARENT = "plugins"
    SORT_ORDER = 50
    ACTIVE = True

    options = [
        config.TextOption("setting", _sep_key(), "; "),
        config.TextOption("setting", _prefix_key(), ""),
    ]
    for _mb_type, _suffix, _default_tag, _enabled_default, _note in _ALL_RELATIONS:
        options.append(config.BoolOption("setting", _enabled_key(_suffix), _enabled_default))
        options.append(config.TextOption("setting", _tag_key(_suffix), _default_tag))
    del _mb_type, _suffix, _default_tag, _enabled_default, _note

    def __init__(self, parent=None):
        super().__init__(parent)
        self._row_widgets = {}
        self._build_ui()

    def _build_ui(self):
        root = QtWidgets.QVBoxLayout(self)
        root.setContentsMargins(6, 6, 6, 6)

        # General settings
        gen = QtWidgets.QGroupBox("General")
        gen_form = QtWidgets.QFormLayout(gen)

        self._sep_edit = QtWidgets.QLineEdit()
        self._sep_edit.setMaximumWidth(80)
        self._sep_edit.setToolTip(
            "Inserted between multiple values for the same tag.\n"
            "Default: '; ' (semicolon + space)."
        )
        gen_form.addRow("Multi-value separator:", self._sep_edit)

        self._prefix_edit = QtWidgets.QLineEdit()
        self._prefix_edit.setMaximumWidth(120)
        self._prefix_edit.setPlaceholderText("e.g. ar_")
        self._prefix_edit.setToolTip(
            "Prefix prepended to every tag written by this plugin.\n"
            "Example: 'ar_' → 'compiler' becomes 'ar_compiler'.\n"
            "Leave empty for no prefix (default).\n\n"
            "Tag names in the table are base names; actual tag = prefix + base."
        )
        gen_form.addRow("Tag prefix:", self._prefix_edit)
        root.addWidget(gen)

        # One tab per entity type
        tabs = QtWidgets.QTabWidget()
        for section_title, section_rels in _ALL_SECTIONS:
            tab = QtWidgets.QWidget()
            tab_vbox = QtWidgets.QVBoxLayout(tab)
            tab_vbox.setContentsMargins(4, 4, 4, 4)

            # Column headers
            hdr = QtWidgets.QWidget()
            hdr_row = QtWidgets.QHBoxLayout(hdr)
            hdr_row.setContentsMargins(0, 0, 0, 0)
            en_lbl = QtWidgets.QLabel("<b>Enable</b>")
            en_lbl.setFixedWidth(55)
            ty_lbl = QtWidgets.QLabel("<b>MB relationship type</b>")
            ty_lbl.setFixedWidth(210)
            tg_lbl = QtWidgets.QLabel("<b>Write to tag (base name)</b>")
            hdr_row.addWidget(en_lbl)
            hdr_row.addWidget(ty_lbl)
            hdr_row.addWidget(tg_lbl)
            hdr_row.addStretch()
            tab_vbox.addWidget(hdr)

            sep_line = QtWidgets.QFrame()
            sep_line.setFrameShape(QtWidgets.QFrame.HLine)
            sep_line.setFrameShadow(QtWidgets.QFrame.Sunken)
            tab_vbox.addWidget(sep_line)

            scroll = QtWidgets.QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setFrameShape(QtWidgets.QFrame.NoFrame)
            inner = QtWidgets.QWidget()
            inner_vbox = QtWidgets.QVBoxLayout(inner)
            inner_vbox.setSpacing(2)
            inner_vbox.setContentsMargins(0, 0, 0, 0)

            for mb_type, suffix, _default, _on, note in section_rels:
                row_w = QtWidgets.QWidget()
                row_hbox = QtWidgets.QHBoxLayout(row_w)
                row_hbox.setContentsMargins(0, 1, 0, 1)

                cb = QtWidgets.QCheckBox()
                cb.setFixedWidth(55)
                cb.setToolTip(note)

                type_lbl = QtWidgets.QLabel(mb_type)
                type_lbl.setFixedWidth(210)
                type_lbl.setToolTip(note)

                tag_edit = QtWidgets.QLineEdit()
                tag_edit.setMaximumWidth(200)
                tag_edit.setToolTip(
                    "Base tag name (prefix will be prepended).\n"
                    "Blank = disabled for this relationship."
                )

                def _on_toggle(checked, te=tag_edit):
                    te.setEnabled(checked)
                cb.toggled.connect(_on_toggle)

                row_hbox.addWidget(cb)
                row_hbox.addWidget(type_lbl)
                row_hbox.addWidget(tag_edit)
                row_hbox.addStretch()
                inner_vbox.addWidget(row_w)
                self._row_widgets[suffix] = (cb, tag_edit)

            inner_vbox.addStretch()
            scroll.setWidget(inner)
            tab_vbox.addWidget(scroll)
            tabs.addTab(tab, section_title)

        root.addWidget(tabs)

        info = QtWidgets.QLabel(
            "<i>⚠ rows are already handled by Picard core and disabled by default. "
            "Types sharing the same base tag name are merged together. "
            "When an enabled type writes to a different tag than Picard's native "
            "one, the native tag is automatically removed to avoid duplicates.</i>"
        )
        info.setWordWrap(True)
        root.addWidget(info)

    def load(self):
        self._sep_edit.setText(config.setting[_sep_key()])
        self._prefix_edit.setText(config.setting[_prefix_key()])
        for _mb_type, suffix, _default, _on, _note in _ALL_RELATIONS:
            cb, tag_edit = self._row_widgets[suffix]
            enabled = config.setting[_enabled_key(suffix)]
            cb.setChecked(enabled)
            tag_edit.setText(config.setting[_tag_key(suffix)])
            tag_edit.setEnabled(enabled)

    def save(self):
        config.setting[_sep_key()] = self._sep_edit.text()
        config.setting[_prefix_key()] = self._prefix_edit.text()
        for _mb_type, suffix, _default, _on, _note in _ALL_RELATIONS:
            cb, tag_edit = self._row_widgets[suffix]
            config.setting[_enabled_key(suffix)] = cb.isChecked()
            config.setting[_tag_key(suffix)] = tag_edit.text().strip()
        _release_cache.clear()
        _extra_relations.clear()
        log.debug("Release Relations Tagger: settings saved, caches cleared.")

    def restore_defaults(self):
        self._sep_edit.setText("; ")
        self._prefix_edit.setText("")
        for _mb_type, suffix, default_tag, enabled_default, _note in _ALL_RELATIONS:
            cb, tag_edit = self._row_widgets[suffix]
            cb.setChecked(enabled_default)
            tag_edit.setText(default_tag)
            tag_edit.setEnabled(enabled_default)


register_options_page(ReleaseRelationsOptionsPage)

# ---------------------------------------------------------------------------
# Supplementary place-rels / area-rels fetch
#
# Picard's default release lookup does NOT include place-rels or area-rels.
# We register an album metadata processor (fires once per release) that issues
# a separate lightweight API call to fetch those two extra include types.
#
# To avoid a timing race with the track processors, we increment
# album._requests before the call and decrement it in the callback — the same
# pattern Picard's cover-art fetching uses. This keeps the album in its
# "loading" state until our data arrives, so tracks are only processed after
# the place/area relations are ready.
# ---------------------------------------------------------------------------
_extra_relations = {}   # release_id -> [extra relation dicts]
_release_cache   = {}   # release_id -> {final_tag: value}


def _on_extra_relations(album, release_id, document, reply, error):
    """Callback for the supplementary place-rels+area-rels request."""
    if error:
        log.warning(
            "Release Relations Tagger: supplementary fetch failed for %s: %s",
            release_id, error,
        )
        _extra_relations[release_id] = []
        return

    try:
        relations = document.get("relations", []) if isinstance(document, dict) else []
        place_area = [r for r in relations
                      if r.get("target-type") in ("place", "area")]
        _extra_relations[release_id] = place_area
        # Invalidate the tag-map cache so it rebuilds with the new data
        # the next time this release is processed (e.g. on refresh).
        _release_cache.pop(release_id, None)
        log.debug(
            "Release Relations Tagger: %s — got %d place/area rels",
            release_id, len(place_area),
        )
    except Exception as exc:
        log.error(
            "Release Relations Tagger: supplementary parse error: %s", exc
        )
        _extra_relations[release_id] = []


def fetch_extra_relations(tagger, metadata, release):
    """
    Album metadata processor — fires once per release.
    Issues a fire-and-forget supplementary API request for place-rels +
    area-rels since Picard omits these from its default release lookup.
    Results are stored in _extra_relations and merged in on the next
    track processing pass (which may require a manual refresh for the
    very first load, since the fetch is asynchronous).
    """
    if isinstance(release, dict):
        release_id = release.get("id", "")
    else:
        release_id = metadata.get("musicbrainz_albumid", "")

    if not release_id or release_id in _extra_relations:
        return  # already fetched or in flight

    # Reserve slot to prevent duplicate requests
    _extra_relations[release_id] = []

    # Find the album for the callback (used only for logging)
    album = tagger.albums.get(release_id)

    tagger.webservice.get(
        "musicbrainz.org",
        443,
        "/ws/2/release/{}".format(release_id),
        handler=lambda document, reply, error: _on_extra_relations(
            album, release_id, document, reply, error
        ),
        parse_response_type="json",
        queryargs={"inc": "place-rels+area-rels", "fmt": "json"},
        priority=False,
        important=False,
    )
    log.debug(
        "Release Relations Tagger: queued supplementary place/area fetch for %s",
        release_id,
    )


register_album_metadata_processor(fetch_extra_relations)


# ---------------------------------------------------------------------------
# Per-release cache and processing
# ---------------------------------------------------------------------------


def _build_tag_map(relations):
    """Parse all relations and return {final_tag_name: joined_value}."""
    sep = config.setting[_sep_key()] or "; "
    prefix = config.setting[_prefix_key()]
    buckets = {}

    # Log every relation received so mismatches can be diagnosed
    for relation in relations:
        log.debug(
            "Release Relations Tagger: relation target-type=%r type=%r",
            relation.get("target-type"), relation.get("type"),
        )

    for relation in relations:
        target_type = relation.get("target-type", "")
        handler = _TARGET_HANDLERS.get(target_type)
        if handler is None:
            continue
        name_fn, type_map = handler

        mb_type = relation.get("type", "").lower()
        suffix = type_map.get(mb_type)
        if suffix is None:
            continue

        if not config.setting[_enabled_key(suffix)]:
            continue

        base_tag = config.setting[_tag_key(suffix)].strip()
        if not base_tag:
            continue

        final_tag = prefix + base_tag
        value = name_fn(relation)
        if not value:
            continue

        if final_tag not in buckets:
            buckets[final_tag] = []
        if value not in buckets[final_tag]:
            buckets[final_tag].append(value)

    return {tag: sep.join(vals) for tag, vals in buckets.items()}


def process_release_relations(album, metadata, track, release):
    release_id = release.get("id", "")

    if release_id not in _release_cache:
        relations = list(release.get("relations", []))
        # Merge in place-rels + area-rels from the supplementary fetch (may be
        # an empty list if the fetch hasn't completed yet or found nothing).
        extra = _extra_relations.get(release_id, [])
        if extra:
            relations = relations + extra
        _release_cache[release_id] = _build_tag_map(relations)
        log.debug(
            "Release Relations Tagger: parsed %s → tags: %s",
            release_id, list(_release_cache[release_id].keys()),
        )

    tag_map = _release_cache[release_id]
    prefix = config.setting[_prefix_key()]

    # Collect all possible final tag names from currently enabled relations
    all_possible = {
        prefix + config.setting[_tag_key(suffix)].strip()
        for _, suffix, *_ in _ALL_RELATIONS
        if config.setting[_enabled_key(suffix)]
    }
    all_possible.discard("")

    # Write or clean up
    for tag in all_possible:
        if tag in tag_map:
            metadata[tag] = tag_map[tag]
        elif tag in metadata:
            log.debug("Release Relations Tagger: deleting stale tag %r", tag)
            del metadata[tag]

    # Remove Picard-native duplicates when our plugin has taken ownership
    for _, suffix, *_ in _ALL_RELATIONS:
        if not config.setting[_enabled_key(suffix)]:
            continue
        native = _PICARD_NATIVE_TAG.get(suffix)
        if not native:
            continue
        our_tag = prefix + config.setting[_tag_key(suffix)].strip()
        if not our_tag:
            continue
        if native == "performer:":
            if our_tag != "performer:":
                for key in list(metadata.keys()):
                    if key.startswith("performer:"):
                        log.debug("Release Relations Tagger: removing native performer tag %r", key)
                        del metadata[key]
        else:
            if our_tag != native and native in metadata:
                log.debug("Release Relations Tagger: removing native tag %r (our tag is %r)", native, our_tag)
                del metadata[native]


register_track_metadata_processor(
    process_release_relations,
    priority=PluginPriority.LOW,
)