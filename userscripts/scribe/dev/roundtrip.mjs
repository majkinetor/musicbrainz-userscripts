import { toModel, emit, parse } from './release-md.mjs';
const MB = 'https://musicbrainz.org';
const inc = 'artist-credits+labels+recordings+release-groups+url-rels+media+annotation';
const ids = process.argv.slice(2); if (!ids.length) ids.push('3aafc2e7-27b4-4793-b6e7-8555dece33db','27239c8f-efaa-4c5f-8019-729b44cfb400');
for (const id of ids) {
  const r = await (await fetch(`${MB}/ws/2/release/${id}?inc=${inc}&fmt=json`, { headers: { 'User-Agent': 'ee-rt/0.1' } })).json();
  const md0 = emit(toModel(r));
  const md1 = emit(parse(md0));
  if (md0 === md1) { console.log(`OK   ${id}  (${md0.split('\n').length} lines, idempotent)`); continue; }
  const a = md0.split('\n'), b = md1.split('\n'); let shown = 0;
  console.log(`FAIL ${id}`);
  for (let i = 0; i < Math.max(a.length, b.length) && shown < 8; i++) if (a[i] !== b[i]) { console.log(`  L${i+1}\n    emit : ${JSON.stringify(a[i])}\n    parse: ${JSON.stringify(b[i])}`); shown++; }
}
