// #623 (sweep, S2 + S3): two ways a Scribe save changed things nobody edited.
//
// S2 — an event with no date is emitted as "- Germany", but the parser took the first
// comma part as the date: {date: "Germany", country: ""}, and an empty country means
// "clear it". Every save cleared the country of every date-less event.
//
// S3 — lengths were formatted minutes first and seconds rounded on their own, so
// 239.6 s came out as 3:60 (MusicBrainz shows 4:00) and 1:02:03 as 62:03. Every save
// reported, and wrote, a length change on such tracks.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('release events and lengths survive a save unchanged', { tag: ['@unit', '@critical'] }, async () => {
  const { parseEvent, ms2len } = await loadFunctions('scribe', ['unesc', 'parseEvent', 'ms2len']);
  const ev = s => JSON.stringify(parseEvent(s));
  check(ev('Germany') === '{"date":"","country":"Germany"}', `a country-only event keeps its country (${ev('Germany')})`);
  check(ev('Bonaire, Sint Eustatius and Saba') === '{"date":"","country":"Bonaire, Sint Eustatius and Saba"}', `…including a country with a comma in its name (${ev('Bonaire, Sint Eustatius and Saba')})`);
  check(ev('2008-09-01') === '{"date":"2008-09-01","country":""}', 'a date-only event');
  check(ev('2008, Bonaire, Sint Eustatius and Saba') === '{"date":"2008","country":"Bonaire, Sint Eustatius and Saba"}', 'a date and a comma country');
  check(ev('-09-01, Japan') === '{"date":"-09-01","country":"Japan"}', 'a date without a year');
  check(ev('2008-09, [Worldwide]') === '{"date":"2008-09","country":"[Worldwide]"}', `an escaped country name is unescaped (${ev('2008-09, [Worldwide]')})`);

  check(ms2len(239600) === '4:00', `239.6 s is 4:00 (${ms2len(239600)})`);
  check(ms2len(3723000) === '1:02:03', `an hour and a bit shows hours (${ms2len(3723000)})`);
  check(ms2len(59499) === '0:59' && ms2len(59500) === '1:00', `rounding at the minute edge (${ms2len(59499)}, ${ms2len(59500)})`);
  check(ms2len(0) === '' && ms2len(null) === '', 'no length stays empty');
});
