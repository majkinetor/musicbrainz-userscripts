# Develop

*Reference for maintainers and other scripts' authors*. The repo-wide procedure is in the root [DEVELOP.md](../../DEVELOP.md).

## The relationship editor

Group Therapy drives MusicBrainz's own relationship editor: it reads each relationship off the rendered rows and writes through `MB.relationshipEditor`'s dispatch, as [Credit Hoarder](../credit_hoarder/DEVELOP.md) does for credits. Removals click MusicBrainz's own × buttons, so the editor stays the source of truth. Nothing is submitted; the user reviews and saves.

**Release group consolidation** is the exception: it posts the additions straight to the internal `/ws/js/edit/create` endpoint as relationship-create edits, one batch per release.

The editor helper is bundled into the script rather than shared, so Group Therapy stays one dependency-free file. Should it become a library for both scripts, it lives outside either and is documented on its own.

## Text parser

Patterns in the text (`txpDirective`): a pasted line of only `{{…}}` sets the pattern for the lines after it, and a trailing `{{…}}` the pattern of its own line. A line's override box beats both. Art Station's AI scan writes these and restates the format in its prompt ([its DEVELOP](../art_station/DEVELOP.md#ai-scan)): a change to the format changes that prompt too.
