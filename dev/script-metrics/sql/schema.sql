-- Schema for the filtered slice of the MusicBrainz edit history.
--
-- This is *not* a copy of the MusicBrainz schema. It holds only the edits our
-- userscripts touched, which is roughly six orders of magnitude smaller than
-- the dump it came from, plus the enum lookups the dump omits.
--
-- Every table is written with INSERT OR REPLACE, so a re-run over a newer dump
-- updates rows in place (an edit that was Open last week and Applied today
-- simply changes status) while `run` keeps one row per ingest for provenance.

PRAGMA foreign_keys = ON;

-- One row per ingest. Keeps the dump identity so any number in the dashboard
-- can be traced back to the exact snapshot it came from.
CREATE TABLE IF NOT EXISTS run (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dump_id         TEXT    NOT NULL,          -- e.g. 20260905-002519
    ran_at          TEXT    NOT NULL,          -- ISO8601 UTC
    notes_matched   INTEGER,
    edits           INTEGER,
    editors         INTEGER,
    duration_s      REAL
);

-- The configured userscripts, mirrored from config/sources.json.
CREATE TABLE IF NOT EXISTS script (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    owner   TEXT NOT NULL,                     -- 'majkinetor' or 'external'
    note    TEXT
);

-- MusicBrainz editors, resolved from editor_sanitized.
CREATE TABLE IF NOT EXISTS editor (
    id      INTEGER PRIMARY KEY,
    name    TEXT
);

-- The edits themselves (mbdump/edit), minus language, which we do not use.
CREATE TABLE IF NOT EXISTS edit (
    id          INTEGER PRIMARY KEY,
    editor      INTEGER NOT NULL,
    type        INTEGER NOT NULL,
    status      INTEGER NOT NULL,
    autoedit    INTEGER NOT NULL,
    open_time   TEXT,
    close_time  TEXT,
    expire_time TEXT,
    quality     INTEGER
);

-- Matching edit notes, stored whole. Keeping the body means re-attributing or
-- re-parsing versions later is a local query, not another 15 GB pass.
CREATE TABLE IF NOT EXISTS note (
    id          INTEGER PRIMARY KEY,
    editor      INTEGER NOT NULL,
    edit        INTEGER NOT NULL,
    text        TEXT    NOT NULL,
    post_time   TEXT
);

-- Which scripts a note was attributed to. A note can match more than one:
-- our scripts preserve a previous script's note when they append to it.
CREATE TABLE IF NOT EXISTS note_script (
    note        INTEGER NOT NULL,
    script      TEXT    NOT NULL,
    pattern     TEXT    NOT NULL,              -- the substring that matched
    version     TEXT,                          -- parsed from the note header
    PRIMARY KEY (note, script)
);

-- Which entity each edit touched (mbdump/edit_area, edit_artist, ...).
CREATE TABLE IF NOT EXISTS edit_entity (
    edit        INTEGER NOT NULL,
    entity_type TEXT    NOT NULL,
    entity_id   INTEGER NOT NULL,
    PRIMARY KEY (edit, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS vote (
    id          INTEGER PRIMARY KEY,
    editor      INTEGER NOT NULL,
    edit        INTEGER NOT NULL,
    vote        INTEGER NOT NULL,
    vote_time   TEXT,
    superseded  INTEGER NOT NULL DEFAULT 0
);

-- Enum lookups. These ids exist only in the MusicBrainz server source, never in
-- the dump, so they are generated into src/mbmeta.py and loaded from there.
CREATE TABLE IF NOT EXISTS edit_type   (id INTEGER PRIMARY KEY, constant TEXT, label TEXT, entity TEXT);
CREATE TABLE IF NOT EXISTS edit_status (id INTEGER PRIMARY KEY, constant TEXT, label TEXT);
CREATE TABLE IF NOT EXISTS vote_type   (id INTEGER PRIMARY KEY, constant TEXT, label TEXT);

CREATE INDEX IF NOT EXISTS ix_note_edit        ON note (edit);
CREATE INDEX IF NOT EXISTS ix_note_editor      ON note (editor);
CREATE INDEX IF NOT EXISTS ix_note_script_s    ON note_script (script);
CREATE INDEX IF NOT EXISTS ix_edit_editor      ON edit (editor);
CREATE INDEX IF NOT EXISTS ix_edit_open        ON edit (open_time);
CREATE INDEX IF NOT EXISTS ix_edit_entity_edit ON edit_entity (edit);
CREATE INDEX IF NOT EXISTS ix_vote_edit        ON vote (edit);

-- Note-grain attribution: one row per (note, script).
DROP VIEW IF EXISTS v_script_note;
CREATE VIEW v_script_note AS
SELECT  ns.script                       AS script_id,
        s.name                          AS script_name,
        s.owner                         AS script_owner,
        n.id                            AS note_id,
        n.edit                          AS edit_id,
        n.editor                        AS script_user,
        n.post_time                     AS post_time,
        ns.version                       AS version,
        ns.pattern                       AS pattern
FROM note_script ns
JOIN note   n ON n.id = ns.note
JOIN script s ON s.id = ns.script;

-- Edit-grain attribution: exactly one row per (script, edit).
--
-- `script_user` is the author of the *note*, not of the edit. Those differ when
-- someone comments on another editor's edit, and the note author is the one who
-- actually ran the script — which is the number "who uses this" wants.
-- Where several notes attribute the same edit to the same script, the earliest
-- one wins.
DROP VIEW IF EXISTS v_script_edit;
CREATE VIEW v_script_edit AS
SELECT  ns.script                       AS script_id,
        s.name                          AS script_name,
        s.owner                         AS script_owner,
        n.edit                          AS edit_id,
        n.editor                        AS script_user,
        e.editor                        AS edit_editor,
        e.type                          AS edit_type,
        e.status                        AS edit_status,
        e.autoedit                      AS autoedit,
        e.open_time                     AS open_time,
        e.close_time                    AS close_time,
        e.quality                       AS quality,
        ns.version                      AS version,
        n.id                            AS note_id
FROM note_script ns
JOIN note   n ON n.id = ns.note
JOIN script s ON s.id = ns.script
LEFT JOIN edit e ON e.id = n.edit
WHERE n.id = (
        SELECT MIN(n2.id)
        FROM note n2
        JOIN note_script ns2 ON ns2.note = n2.id
        WHERE n2.edit = n.edit AND ns2.script = ns.script
);
