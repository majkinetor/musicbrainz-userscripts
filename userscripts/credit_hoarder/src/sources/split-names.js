// #411: streaming providers sometimes pack several people into ONE credit — Qobuz with
// commas ("E. Themba, T.J. Masingi", "Jeremy Mage, Dean Jones"), Tidal with "&"
// ("Jason Jaknunas & Pierre Chrétien") — and mint a combined-artist id/URL for the pair
// that maps to no single MusicBrainz artist (it 404s on lookup). Left whole, the credit
// resolves to nothing; split, each half resolves on its own and merges across sources.
//
// The guard against shredding a legitimate comma/&-bearing name: only split when EVERY
// segment reads as an independent MULTI-WORD personal name (contains a space). That splits
// the combined credits above but leaves intact:
//   - band/ensemble names with a single-token part — "Earth, Wind & Fire",
//     "Crosby, Stills & Nash", "Simon & Garfunkel", "Tyler, The Creator";
//   - "Last, First" classical credits — "Bach, Johann Sebastian";
//   - "Foo, Inc." and similar.
// Callers drop the provider's combined-artist URL for the split names (it's bogus).
export function splitCombinedNames(name) {
    if (!name || !/[,&]/.test(name)) return [name];
    const parts = name.split(/\s*,\s*|\s*&\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2 || !parts.every(p => /\s/.test(p))) return [name];
    return parts;
}
