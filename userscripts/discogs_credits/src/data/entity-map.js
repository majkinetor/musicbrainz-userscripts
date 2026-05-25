export const ENTITY_TYPE_MAP = {
    // Places
    'Arranged At': {
        entityType: 'place',
        linkType: 'arranged at',
    },
    'Engineered At': {
        entityType: 'place',
        linkType: 'engineered at',
    },
    'Recorded At': {
        entityType: 'place',
        linkType: 'recorded at',
    },
    'Mixed At': {
        entityType: 'place',
        linkType: 'mixed at',
    },
    'Mastered At': {
        entityType: 'place',
        linkType: 'mastered at',
    },
    'Lacquer Cut At': {
        entityType: 'place',
        linkType: 'lacquer cut at',
    },
    'edited At': {
        entityType: 'place',
        linkType: 'edited at',
    },
    'Remixed At': {
        entityType: 'place',
        linkType: 'remixed at',
    },
    'Produced At': {
        entityType: 'place',
        linkType: 'produced at',
    },
    'Overdubbed At': null,
    'manufactured At': {
        entityType: 'place',
        linkType: 'manufactured at',
    },
    'Glass Mastered At': {
        entityType: 'place',
        linkType: 'glass mastered at',
    },
    'Pressed At': {
        entityType: 'place',
        linkType: 'pressed at',
    },
    'Designed At': null,
    'Filmed At': null,
    'Exclusive Retailer': null,
    // labels
    'Copyright (c)': {
        entityType: 'label',
        linkType: 'copyright',
    },
    'Phonographic Copyright (p)': {
        entityType: 'label',
        linkType: 'phonographic copyright',
    },
    'Copyright ©': {
        entityType: 'label',
        linkType: 'copyright',
    },
    'Phonographic Copyright ℗': {
        entityType: 'label',
        linkType: 'phonographic copyright',
    },
    'Licensed From': {
        entityType: 'label',
        linkType: 'licensor',
    },
    'Licensed To': {
        entityType: 'label',
        linkType: 'licensee',
    },
    'Licensed Through': null,
    'Distributed By': {
        entityType: 'label',
        linkType: 'distributed',
    },
    'Made By': {
        entityType: 'label',
        linkType: 'manufactured',
    },
    'Manufactured By': {
        entityType: 'label',
        linkType: 'manufactured',
    },
    'Glass Mastered By': {
        entityType: 'label',
        linkType: 'glass mastered',
    },
    'Pressed By': {
        entityType: 'label',
        linkType: 'pressed',
    },
    'Marketed By': {
        entityType: 'label',
        linkType: 'marketed',
    },
    'Printed By': {
        entityType: 'label',
        linkType: 'printed',
    },
    'Promoted By': {
        entityType: 'label',
        linkType: 'promoted',
    },
    'Published By': {
        entityType: 'label',
        linkType: 'published',
    },
    'Rights Society': {
        entityType: 'label',
        linkType: 'rights society',
    },
    'Arranged For': {
        entityType: 'label',
        linkType: 'arranged for',
    },
    'Manufactured For': {
        entityType: 'label',
        linkType: 'manufactured for',
    },
    'Mixed For': {
        entityType: 'label',
        linkType: 'mixed for',
    },
    'Produced For': {
        entityType: 'label',
        linkType: 'produced for',
    },
    'Miscellaneous Support': {
        entityType: 'label',
        linkType: 'misc',
    },
    'Exported By': null,
    // Artists
    Performer: {
        entityType: 'artist',
        linkType: 'performer',
    },
    // Discogs role "Accompanied By" → MB has no dedicated link type or
    // attribute for this. Closest semantic fit is `performer` with the
    // `additional` attribute (used elsewhere in MB for non-primary
    // contributions). Previously this fell through to the INSTRUMENTS map
    // and was dispatched as a bare `instrument` rel with the bogus
    // attribute value "accompanied by" — which MB silently drops, leaving
    // a junk instrument rel with no instrument named.
    'Accompanied By': {
        entityType: 'artist',
        linkType: 'performer',
        attributes: ['additional'],
    },
    Instruments: {
        entityType: 'artist',
        linkType: 'instrument',
    },
    Vocals: {
        entityType: 'artist',
        linkType: 'vocal',
    },
    'Backing Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'background vocals' }],
    },
    Choir: {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    Chorus: {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    'Choir Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'choir vocals' }],
    },
    'Lead Vocals': {
        entityType: 'artist',
        linkType: 'vocal',
        attributes: [{ _type: 'vocal', value: 'lead vocals' }],
    },
    Orchestra: {
        entityType: 'artist',
        linkType: 'orchestra',
    },
    Conductor: {
        entityType: 'artist',
        linkType: 'conductor',
    },
    'Chorus Master': {
        entityType: 'artist',
        linkType: 'chorus master',
    },
    Concertmaster: {
        entityType: 'artist',
        linkType: 'concertmaster',
    },
    Concertmistress: {
        entityType: 'artist',
        linkType: 'concertmaster',
    },
    'Compiled By': {
        entityType: 'artist',
        linkType: 'compiler',
    },
    'DJ Mix': {
        entityType: 'artist',
        linkType: 'DJ-mixer',
    },
    Remix: {
        entityType: 'artist',
        linkType: 'remixer',
    },
    'contains samples by': {
        entityType: 'artist',
        linkType: 'contains samples by',
    },
    'Written-By': {
        entityType: 'artist',
        linkType: 'writer',
    },
    'Written By': {
        entityType: 'artist',
        linkType: 'writer',
    },
    'Composed By': {
        entityType: 'artist',
        linkType: 'composer',
    },
    'Words By': {
        entityType: 'artist',
        linkType: 'lyricist',
    },
    'Lyrics By': {
        entityType: 'artist',
        linkType: 'lyricist',
    },
    'Libretto By': {
        entityType: 'artist',
        linkType: 'librettist',
    },
    'Translated By': {
        entityType: 'artist',
        linkType: 'translator',
    },
    'Arranged By': {
        entityType: 'artist',
        linkType: 'arranger',
    },
    'Instrumentation By': {
        entityType: 'artist',
        linkType: 'instruments arranger',
    },
    'Orchestrated By': {
        entityType: 'artist',
        linkType: 'orchestrator',
    },
    'vocals arranger': {
        entityType: 'artist',
        linkType: 'vocals arranger',
    },
    Producer: {
        entityType: 'artist',
        linkType: 'producer',
    },
    'Co-producer': {
        entityType: 'artist',
        linkType: 'producer',
        // MB has no `co` attribute. The convention for "Co-X" is `additional`
        // on the base role (issue #3). See also the matching remap in
        // `getArtistRoles` for the regex /Co /.
        attributes: ['additional'],
    },
    'Executive-Producer': {
        entityType: 'artist',
        linkType: 'producer',
        attributes: ['executive'],
    },
    'Post Production': {
        entityType: 'artist',
        linkType: 'producer',
    },
    Engineer: {
        entityType: 'artist',
        linkType: 'engineer',
    },
    'Audio Engineer': {
        entityType: 'artist',
        linkType: 'audio engineer',
    },
    'Mastered By': {
        entityType: 'artist',
        linkType: 'mastering',
    },
    'Remastered By': {
        entityType: 'artist',
        linkType: 'mastering',
        attributes: ['re'],
    },
    'Lacquer Cut By': {
        entityType: 'artist',
        linkType: 'lacquer cut',
    },
    'sound engineer': {
        entityType: 'artist',
        linkType: 'sound engineer',
    },
    'Mixed By': {
        entityType: 'artist',
        linkType: 'mix',
    },
    'Recorded By': {
        entityType: 'artist',
        linkType: 'recording',
    },
    'Recording Engineer': {
        entityType: 'artist',
        linkType: 'recording',
    },
    'Programmed By': {
        entityType: 'artist',
        linkType: 'programming',
    },
    Editor: {
        entityType: 'artist',
        linkType: 'editor',
    },
    'Edited By': {
        entityType: 'artist',
        linkType: 'editor',
    },
    'balance engineer': {
        entityType: 'artist',
        linkType: 'engineer',
    },
    'copyrighted by': {
        entityType: 'artist',
        linkType: 'copyright',
    },
    'phonographic copyright by': {
        entityType: 'artist',
        linkType: 'phonographic copyright',
    },
    Legal: {
        entityType: 'artist',
        linkType: 'legal representation',
    },
    Booking: {
        entityType: 'artist',
        linkType: 'booking',
    },
    'Art Direction': {
        entityType: 'artist',
        linkType: 'art direction',
    },
    Artwork: {
        entityType: 'artist',
        linkType: 'artwork',
    },
    'Artwork By': {
        entityType: 'artist',
        linkType: 'artwork',
    },
    Cover: {
        entityType: 'artist',
        linkType: 'artwork',
    },
    Design: {
        entityType: 'artist',
        linkType: 'design',
    },
    'Graphic Design': {
        entityType: 'artist',
        linkType: 'graphic design',
    },
    Illustration: {
        entityType: 'artist',
        linkType: 'illustration',
    },
    'Booklet Editor': {
        entityType: 'artist',
        linkType: 'booklet editor',
    },
    Photography: {
        entityType: 'artist',
        linkType: 'photography',
    },
    'Photography By': {
        entityType: 'artist',
        linkType: 'photography',
    },
    Technician: {
        entityType: 'artist',
        linkType: 'instruments technician',
    },
    publisher: {
        entityType: 'artist',
        linkType: 'published',
    },
    'Liner Notes': {
        entityType: 'artist',
        linkType: 'liner notes',
    },
    'A&R': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Advisor: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Concept By': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Contractor: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Coordinator: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Management: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Musical Assistance': {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Tour Manager': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Other: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Public Relations': {
        entityType: 'artist',
        linkType: 'misc',
    },
    Promotion: {
        entityType: 'artist',
        linkType: 'misc',
    },
    Crew: {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Supervised By': {
        entityType: 'artist',
        linkType: 'misc',
    },
    'Director Of Photography': {
        entityType: 'artist',
        linkType: 'photography',
        attributes: [{ _type: 'task', value: 'director of photography' }],
    }
};
