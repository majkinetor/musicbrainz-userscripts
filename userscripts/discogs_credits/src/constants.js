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
