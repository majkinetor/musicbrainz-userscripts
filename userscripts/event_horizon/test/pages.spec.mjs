import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('a recording page shows its hero, credits and releases', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/recording/2460a241-6ff4-49f1-80f9-36051534e9ae');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/recording|video/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names a recording');
  check(await until(() => page.locator('#s-ed').count(), n => n === 1) === 1, 'the releases section shows');
  check(await page.locator('#s-cr').count() === 1, 'the credits section shows');
  await attachShot(testInfo, page, 'recording');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-recording.png'), fullPage: true });
});

test('an area page shows its hero and its artists, labels and places', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/area/02b60d8d-7164-339d-868d-22d147d9f74a');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/country/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names a country');
  check(await until(() => page.locator('#s-aa tbody tr').count(), n => n > 0) > 0, 'the artists table fills in');
  await attachShot(testInfo, page, 'area');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-area.png'), fullPage: true });
});

test('an instrument page shows its Commons picture, what it is a subtype of, and its tabs as tables', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/instrument/46ec6044-6c57-4ebe-8c1e-762f19b66340');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/percussion/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names its type');
  check(await until(() => page.locator('#app img.ipic').evaluate(i => i.complete && i.naturalWidth).catch(() => 0), n => n > 0) > 0, 'the Commons picture loads');
  check(/barrel drum/i.test(await page.locator('#app .facts').innerText()), 'it is a subtype of barrel drum');
  check(await until(() => page.locator('#app .sec.pend').count(), n => n === 0) === 0, 'every section has loaded');
  await attachShot(testInfo, page, 'instrument');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-instrument.png'), fullPage: true });
});

test('a place page shows where it is, its parts, and its events and recordings', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/place/bd55aeb7-19d1-4607-a500-14b8479d3fed');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/studio/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names its type');
  const facts = await page.locator('#app .facts').innerText();
  check(/london/i.test(facts), 'its area shows');
  check(/51\.53/.test(facts), 'its coordinates show');
  check(/parts/i.test(facts), 'its parts show');
  check(await until(() => page.locator('#app .sec.pend').count(), n => n === 0) === 0, 'every section has loaded');
  check(await page.locator('#s-pr tbody tr').count() > 0, 'the recordings table fills in');
  await attachShot(testInfo, page, 'place');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-place.png'), fullPage: true });
});

test('a series page shows its type and its parts as a table', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/series/bcef3f59-7559-4736-9228-dfeba507b5c0');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/release group series/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names its type');
  check(await until(() => page.locator('#app .sec.pend').count(), n => n === 0) === 0, 'every section has loaded');
  check(/release groups/i.test(await page.locator('#s-sp').innerText()), 'the parts are named after the type');
  check(await page.locator('#s-sp tbody tr').count() > 5, 'the parts table fills in');
  check(await page.locator('#s-sp tbody tr td.tc img[src*="coverartarchive.org/release-group/"]').count() > 5, 'each part leads with its cover');
  const first = () => page.locator('#s-sp tbody tr td:nth-child(4)').first().innerText();
  const before = await first();
  await page.locator('#s-sp thead button[data-tsort]').filter({ hasText: /title/i }).click();
  await page.locator('#s-sp thead button[data-tsort]').filter({ hasText: /title/i }).click();
  check(await page.locator('#s-sp thead th[aria-sort="descending"]').count() === 1, 'a second click sorts the other way');
  const titles = await page.locator('#s-sp tbody tr td:nth-child(4)').allInnerTexts();
  check(titles.every((t, i) => !i || titles[i - 1].localeCompare(t, undefined, { sensitivity: 'base', numeric: true }) >= 0), 'the rows are sorted by title, descending');
  await page.locator('#s-sp thead button[data-tsort]').filter({ hasText: /title/i }).click();
  check(await first() === before, "a third click brings back MusicBrainz's order");
  await attachShot(testInfo, page, 'series');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-series.png'), fullPage: true });
});

test('an event page shows its date, time and setlist', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/event/b453f5ec-149b-4240-abaf-e12d32573ca9');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(/concert/i.test(await page.locator('#app .kicker').innerText()), 'the kicker names its type');
  const facts = await page.locator('#app .facts').innerText();
  check(/2021/.test(facts), 'its date shows');
  check(/20:30/.test(facts), 'its time shows');
  check(await page.locator('#app .acts a[href$="/event-art"]').count() === 1, 'the bar links its event art');
  check(await page.locator('#s-sl .setl li').count() >= 4, 'its setlist shows');
  check(await page.locator('#s-sl .setl a[href*="/mbid/"]').count() === 1, 'a setlist link is a link');
  await attachShot(testInfo, page, 'event');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-event.png'), fullPage: true });
});

test('an event-art page puts the event in its header', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/event/b453f5ec-149b-4240-abaf-e12d32573ca9/event-art');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .arthd h1 a').count(), n => n === 1) === 1, 'the header names the event');
  check(/EH test concert/.test(await page.locator('#app .arthd h1').innerText()), 'with its name');
  check(await until(() => page.locator('#app .arthd .kicker').innerText(), t => /concert/i.test(t)).then(t => /event art/i.test(t)), 'the kicker says event art and the type');
  check(await page.locator('#as-slot').count() === 1, "Art Station's slot is there");
  await attachShot(testInfo, page, 'event-art');
});

test("an event's and a series' annotation forms take Event Horizon's header", { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  for (const [type, id, name] of [['event', 'b453f5ec-149b-4240-abaf-e12d32573ca9', /EH test concert/], ['series', 'bcef3f59-7559-4736-9228-dfeba507b5c0', /Think Global/]]) {
    await page.goto(`https://test.musicbrainz.org/${type}/${id}/edit_annotation`);
    await inject('event_horizon');
    check(await until(() => page.locator('#eh-relhd h1 a').count(), n => n === 1) === 1, `the ${type} form has the header`);
    check(name.test(await page.locator('#eh-relhd h1').innerText()), `it names the ${type}`);
    check(/annotation/i.test(await page.locator('#eh-relhd .kicker').innerText()), 'the kicker names the form');
    check(await page.locator('textarea[name$="text"]').count() === 1, "MusicBrainz's form is still there");
    await attachShot(testInfo, page, type + '-annotation');
  }
});

test('a work page shows its hero, credits and recordings', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/work/afec4a5d-5ac6-309a-be7c-ee4f919730c3');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hero h1').count(), n => n === 1) === 1, 'the hero shows');
  check(await until(() => page.locator('#s-rc tbody tr').count(), n => n > 0) > 0, 'the recordings table fills in');
  check(await page.locator('#s-cr').count() === 1, 'the credits section shows');
  await attachShot(testInfo, page, 'work');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-work.png'), fullPage: true });
});
