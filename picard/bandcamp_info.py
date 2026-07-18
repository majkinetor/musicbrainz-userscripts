# -*- coding: utf-8 -*-

PLUGIN_NAME = "Bandcamp Info"
PLUGIN_AUTHOR = "majkinetor"
PLUGIN_DESCRIPTION = "Fetch Bandcamp tags + description with configurable tag names"
PLUGIN_VERSION = "1.7"
PLUGIN_API_VERSIONS = ["2.0"]

import re
import json
import html
from urllib.request import Request, urlopen

from picard import log
from picard.metadata import register_album_metadata_processor
from picard.config import get_config, TextOption, BoolOption
from picard.ui.options import OptionsPage, register_options_page

from PyQt5 import QtWidgets

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

cache = {}

# ----------------------------
# Regex
# ----------------------------
tralbum_regex = re.compile(r"var TralbumData = ({.*?});", re.DOTALL)
tag_regex = re.compile(r'<a[^>]+class="tag"[^>]*>([^<]+)</a>')

about_block_regex = re.compile(
    r'<div[^>]*class="[^"]*tralbum-about[^"]*"[^>]*>(.*?)</div>',
    re.DOTALL | re.IGNORECASE
)

# ----------------------------
# Helpers
# ----------------------------
def get_setting(cfg, key, default):
    try:
        return cfg.setting[key]
    except KeyError:
        return default


def html_to_text(s):
    if not s:
        return ""

    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.IGNORECASE)
    s = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', s, flags=re.DOTALL)
    s = re.sub(r'<[^>]+>', '', s)

    s = html.unescape(s)
    s = re.sub(r'\n\s*\n\s*\n+', '\n\n', s)

    return s.strip()


# ----------------------------
# UI
# ----------------------------
class BandcampOptionsPage(OptionsPage):
    NAME = "bandcamp"
    TITLE = "Bandcamp"
    PARENT = "plugins"

    options = [
        TextOption("setting", "bandcamp_tag_field", "bandcamp_tags"),
        TextOption("setting", "bandcamp_desc_field", "bandcamp_description"),
        BoolOption("setting", "bandcamp_enable_tags", True),
        BoolOption("setting", "bandcamp_enable_desc", True),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)

        layout = QtWidgets.QFormLayout()

        self.enable_tags = QtWidgets.QCheckBox("Enable tags")
        self.enable_desc = QtWidgets.QCheckBox("Enable description")

        self.tag_field = QtWidgets.QLineEdit()
        self.desc_field = QtWidgets.QLineEdit()

        layout.addRow(self.enable_tags)
        layout.addRow("Tag field name:", self.tag_field)

        layout.addRow(self.enable_desc)
        layout.addRow("Description field name:", self.desc_field)

        self.setLayout(layout)

    def load(self):
        cfg = get_config()

        self.enable_tags.setChecked(get_setting(cfg, "bandcamp_enable_tags", True))
        self.enable_desc.setChecked(get_setting(cfg, "bandcamp_enable_desc", True))

        self.tag_field.setText(get_setting(cfg, "bandcamp_tag_field", "bandcamp_tags"))
        self.desc_field.setText(get_setting(cfg, "bandcamp_desc_field", "bandcamp_description"))

    def save(self):
        cfg = get_config()

        cfg.setting["bandcamp_enable_tags"] = self.enable_tags.isChecked()
        cfg.setting["bandcamp_enable_desc"] = self.enable_desc.isChecked()

        cfg.setting["bandcamp_tag_field"] = self.tag_field.text().strip() or "bandcamp_tags"
        cfg.setting["bandcamp_desc_field"] = self.desc_field.text().strip() or "bandcamp_description"


register_options_page(BandcampOptionsPage)


# ----------------------------
# Fetch + parse
# ----------------------------
def fetch_bandcamp_data(url):
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        page = urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")

        tags = []
        description = ""

        # JSON attempt
        match = tralbum_regex.search(page)
        if match:
            try:
                data = json.loads(match.group(1))
                tags = data.get("tags", []) or []

                about = data.get("about", "") or ""
                credits = data.get("credits", "") or ""

                description = "\n\n".join(
                    [t.strip() for t in (about, credits) if t.strip()]
                )

            except Exception as e:
                log.debug(f"Bandcamp JSON parse failed: {e}")

        # HTML fallback
        if not description:
            m = about_block_regex.search(page)
            if m:
                description = html_to_text(m.group(1))

        # Tag fallback
        if not tags:
            tags = re.findall(tag_regex, page)

        tags = [html.unescape(t).strip().lower() for t in tags if t.strip()]
        description = description.strip()

        return tags, description

    except Exception as e:
        log.error(f"Bandcamp fetch failed for {url}: {e}")
        return [], ""


# ----------------------------
# URL extraction
# ----------------------------
def extract_bandcamp_url(relations):
    if not relations:
        return None

    for rel in relations:
        if rel.get("target-type") != "url":
            continue

        url_data = rel.get("url")
        if not url_data:
            continue

        url = url_data.get("resource", "")

        if "bandcamp.com" in url and "/album/" in url:
            return url

    return None


def get_bandcamp_url(release):
    if release:
        rg = release.get("release-group")
        if rg:
            url = extract_bandcamp_url(rg.get("relations"))
            if url:
                return url

    if release:
        url = extract_bandcamp_url(release.get("relations"))
        if url:
            return url

    return None


# ----------------------------
# Main processor
# ----------------------------
def process_album(album, metadata, release):
    url = get_bandcamp_url(release)

    if not url:
        return

    if url in cache:
        tags, description = cache[url]
    else:
        tags, description = fetch_bandcamp_data(url)
        cache[url] = (tags, description)

    if not tags and not description:
        return

    cfg = get_config()

    enable_tags = get_setting(cfg, "bandcamp_enable_tags", True)
    enable_desc = get_setting(cfg, "bandcamp_enable_desc", True)

    tag_field = get_setting(cfg, "bandcamp_tag_field", "bandcamp_tags")
    desc_field = get_setting(cfg, "bandcamp_desc_field", "bandcamp_description")

    seen = set()
    tags_unique = [t for t in tags if not (t in seen or seen.add(t))]
    tags_str = ", ".join(tags_unique)

    # Album-level
    if enable_tags and tags_str:
        metadata[tag_field] = tags_str

    if enable_desc and description:
        metadata[desc_field] = description

    # File-level
    for track in album.tracks:
        for file in track.linked_files:
            if enable_tags and tags_str:
                file.metadata[tag_field] = tags_str
            if enable_desc and description:
                file.metadata[desc_field] = description

    log.debug(
        f"Bandcamp {url} -> tags={tags_unique if enable_tags else 'DISABLED'}, "
        f"desc_len={len(description) if enable_desc else 'DISABLED'}"
    )


register_album_metadata_processor(process_album)