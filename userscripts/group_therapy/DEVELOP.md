# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## The relationship editor

Group Therapy drives MusicBrainz's own relationship editor: it reads each relationship off the rendered rows and writes through `MB.relationshipEditor`'s dispatch, as [Credit Hoarder](../credit_hoarder/DEVELOP.md) does for credits. Removals click MusicBrainz's own × buttons, so the editor stays the source of truth. Nothing is submitted; the user reviews and saves.

**Release group consolidation** is the exception: it posts the additions straight to the internal `/ws/js/edit/create` endpoint as relationship-create edits, one batch per release.

The editor helper is bundled into the script rather than shared, so Group Therapy stays one dependency-free file. Should it become a library for both scripts, it lives outside either and is documented on its own.

## Text parser

Patterns in the text (`txpDirective`): a pasted line of only `{{…}}` sets the pattern for the lines after it, and a `{{…}}` anywhere else in a line the pattern of its own line (it's cut out of the text). Pattern literals match case-insensitively. A line's override box beats both. Art Station's AI scan writes these and restates the format in its prompt ([its DEVELOP](../art_station/DEVELOP.md#ai-scan)): a change to the format changes that prompt too.

## Text parser matching

Each name's candidates are ranked by `mbmRankCandidates` from the shared matcher (`dev/match/artist-match.mjs`), on this evidence:

- **The page**, read at ⚡ Match with no request: the release and track artist credits, the release labels, and both ends of every `.relationship-item` (this session's additions too).
- **The identity search** (`/ws/2/<artist|label>?query=alias:"x" OR <kind>:"x"`, up to 100): its holders of the name are the candidates, with their type, life span and area. Places, and names nobody holds, fall back to `/ws/js/<kind>`.
- **Related artists**: one `/ws/2/artist/<mbid>?inc=aliases+artist-rels` per real release artist (four at most), cached for the page's life.
- **Beyond the release**, approved on #798 as step 4, always on:
  - **The release group**: `/ws/2/release?release-group=<mbid>&limit=25`, then the first three other releases with `inc=artist-credits+labels+artist-rels+label-rels+place-rels+recordings+recording-level-rels+work-level-rels+work-rels` (about 200 KB each); once per page. An entity credited there with the name scores `same group` (+50, strong).
  - **Co-credits**: for a name still without a pick, `/ws/2/recording?query=arid:<release artist> AND artistname:"x"` for the first two release artists, as Credit Hoarder's; an artist credited as the name beside them scores `co-credit` (+40, strong).
  - Not done: whether a candidate has held the role before. `/ws/2/artist/<mbid>?inc=release-rels` is 2.4 MB for Bob Ludwig, and `recording-rels+work-rels` 3–4 MB for John Williams or Paul McCartney, per candidate.
- **Remembered picks**: GM `gt-tp-picks`, `{ "<release artist mbid>|<folded name>": { gid, name, kind } }`, the newest 3000.

The cutoff is GM `gt-tp-cutoff` (`strong` · `unique` · `weak`). The candidates and who picked what stay with the parser's other state, per release, until the page reloads.

## Text parser roles

A role text is matched, in order, by: your earlier pick for that text (GM `gt-tp-roles`, keyed `release|text` or `recording|text`, since a pair's link types differ); the link-type names (exact, contained, a common stem); then the word scan (`txpRoleScan`). The scan only sees the link types of the credit's kind, and reads each type's name and its `link_phrase`, `reverse_link_phrase` and `long_link_phrase` with the `{…}` placeholders removed (in MusicBrainz's interface language), plus `TXP_ROLE_SYNONYMS`. Stop words (*by, at, of, and, all*…) and words under three letters don't count. Per word, a type scores 3 when a whole phrase is the word, 2 when a phrase contains it, 1 when a stem matches; *music*, *lyrics* and the other made things count double. A stem is the word less one common ending (*-ation, -tion, -ing, -ist, -er, -ed, -es, -s*) when four letters are left; two words match when one stem starts the other (*writ* · *written*, *produc* · *produced*). One type ahead is taken; a tie is offered on the chip, four at most.
