// majkinetor (with a screenshot of the Artists rows): "Matched by position not name should be more
// prominent as it is easy to miss". Platform Check lists that reason in the finding's mismatch, and
// the row draws it in amber, bold; a row matched by name has no such reason. A stand-in PC answers.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's
const WHY = 'matched by position, not name ("Grupo O.K. Jazz" on the platform)';

test('a link matched by position only shows its reason in amber, bold', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(why => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const a = (mbid, name) => ({ type: 'artist', mbid, name });
    const findings = [
      { key: 'ent:artist:a1:apple', icon: 'apple', name: 'OK Jazz · Apple', url: 'https://music.apple.com/gb/artist/1478174959', state: 'new', why, mismatch: [why], entity: a('a1', 'OK Jazz') },
      { key: 'ent:artist:a2:apple', icon: 'apple', name: 'Dewayon · Apple', url: 'https://music.apple.com/gb/artist/354553319', state: 'new', entity: a('a2', 'Dewayon') }];
    document.addEventListener('mc:probe', e => { const d = JSON.parse(e.detail); setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings }), 50); });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  }, WHY);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line[data-key="ent:artist:a2:apple"]');

  const row = key => page.locator(`#mc-root .mc-line[data-key="${key}"]`).evaluate(l => {
    const b = l.querySelector('.s b.mc-off');
    return { text: b && b.textContent, weight: b && getComputedStyle(b).fontWeight, color: b && getComputedStyle(b).color, plain: getComputedStyle(l.querySelector('a.s')).color, on: l.classList.contains('on') };
  });
  const pos = await row('ent:artist:a1:apple'), name = await row('ent:artist:a2:apple');
  console.log(JSON.stringify({ pos, name }));
  check(pos.text === WHY && +pos.weight >= 600 && pos.color !== pos.plain, `the position reason is bold and coloured (${JSON.stringify(pos)})`);
  check(pos.on, 'it is still taken in by default');
  check(name.text === null, `a row matched by name has no stressed reason (${JSON.stringify(name)})`);
  await attachShot(testInfo, page.locator('#mc-root [data-card="pc"]'), 'pc-artists');
});
