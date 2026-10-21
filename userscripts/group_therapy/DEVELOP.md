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
- **Remembered picks**: GM `gt-tp-picks`, `{ "<release artist mbid>|<folded name>": { gid, name, kind } }`, the newest 3000.

The cutoff is GM `gt-tp-cutoff` (`strong` · `unique` · `weak`). The candidates and who picked what stay with the parser's other state, per release, until the page reloads.
