// Pure data constants used across the userscript. Zero-dep.

/**
 * Skeleton object MB's relationship-editor reducer expects when adding a new
 * relationship. The script clones this and fills in `linkTypeID`, `entity0`,
 * `entity1`, `attributes`, etc. before dispatching.
 *
 * `_status: 1` = "added this session" in MB's internal state model
 * (0 = persisted, 1 = added, 2 = removed, 3 = edited).
 */
export const REL_TEMPLATE = {
    _lineage: [],
    _original: null,
    _status: 1,
    attributes: null,
    begin_date: null,
    editsPending: false,
    end_date: null,
    ended: false,
    entity0_credit: '',
    entity1_credit: '',
    id: null,
    linkOrder: 0,
    linkTypeID: null,
};

/**
 * CSS selectors for the MB add-relationship dialog. Centralised so a layout
 * change at MB only requires editing this object.
 */
export const SELECTORS = {
    MediumsInput: '.multiselect-input',
    MediumsInputOptions: '.multiselect-input + .menu a',
    InstrumentsInput: '#add-relationship-dialog .multiselect.instrument input[aria-autocomplete]',
    VocalsTypeInput: '#add-relationship-dialog .multiselect.vocal input[aria-autocomplete]',
    AddRelationshipsDialogEntityType: '#add-relationship-dialog .entity-type',
    AddRelationshipsDialogRelationshipType: '#add-relationship-dialog input.relationship-type',
    AddRelationshipsDialogRelationshipTarget: '#add-relationship-dialog input.relationship-target',
    AddRelationshipsDialogEntityCredit: '#add-relationship-dialog input.entity-credit',
    AddRelationshipsDialogDoneButton: '#add-relationship-dialog .buttons button.positive',
    AddRelationshipsDialogError: '#add-relationship-dialog .error',
    AddRelationshipsDialogCancelButton: '#add-relationship-dialog .buttons button.negative',
    AddReleaseRelationshipButton: '#release-rels button.add-relationship',
    EditNote: '#edit-note-text',
    TaskInput: '#add-relationship-dialog .attribute-container.task input',
};

export const DISCOGS_LOGO_URL = 'https://volkerzell.de/favicons/discogs.png';

/**
 * Cross-tab channel used by the "Create in MB" flow. The userscript runs on
 * MB artist/label/place pages too — when it detects it was opened from the
 * review table (post-creation), it broadcasts the newly-created entity's
 * MBID + name back here so the review-table row auto-fills.
 *
 * One channel module-wide so both the entry-bootstrap listener and the
 * review-table-side `renderActions` see the same instance. Without this
 * export, review-table.js referenced a free `DISCOGS_CHANNEL` symbol that
 * only existed in the entry module's scope → ReferenceError at runtime.
 */
export const DISCOGS_CHANNEL = new BroadcastChannel('discogs-importer-artist');

/**
 * The page's real `window` — Tampermonkey exposes it as `unsafeWindow` to
 * userscripts; Greasemonkey/Violentmonkey too. In Playwright (test mode) or
 * any environment without that grant, we fall through to plain `window`.
 *
 * Use `pageWindow` to read MB-provided globals like `MB.relationshipEditor`
 * or `MB.linkedEntities` that live on the page's own JS context.
 */
export const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
