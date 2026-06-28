export const WORK_ONLY_ARTIST_RELS = [
    'writer',
    'composer',
    'lyricist',
    'librettist',
    'revised by',
    // NOT 'translator' — a translator credit (liner notes / lyrics / libretto) is a
    // release-wide credit, so it dispatches at RELEASE level (artist↔release
    // "translator"), not duplicated onto every work. (MB has the artist-release rel.)
    'reconstructed by',
    // 'arranger',
    // 'instruments arranger',
    'orchestrator',
    // 'vocals arranger',
    'previously attributed to',
    'miscellaneous support',
    'dedicated to',
    'premiered by',
    'was commissioned by',
    'publisher',
    'inspired the name of',
];
