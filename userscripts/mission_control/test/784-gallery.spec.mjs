// #784: Art Station's card shows Art Station's own gallery (its frame, kept over the card's slot by Art Station).
// Mission Control tells Art Station whether the best front's source is taken in (mc:stage), shows the gallery's plan
// (mc:plan) and counts its changes beyond the best front; Execute sends the source rows alone (no extras), and runs
// Art Station when only the gallery has changes.
// A stand-in AS answers the probe and the apply and sends a plan, as the gallery does.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#784: the gallery\'s slot, stage and plan; Execute runs what the gallery holds', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 2400, height: 1000 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applied = []; window.__stage = [];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      // a second card beside Art Station's: Platform Check, with one link it isn't sure of
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings: [{ key: 'x', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'unsure' }] }), 40);   // unsure: not selected, so Execute's count is Art Station's
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'Amazon', name: 'Amazon', url: 'https://www.amazon.com/dp/B000', state: 'new', role: 'best' }],
        best: { provider: 'Amazon', w: 1500, h: 1500, bytes: 300000, of: 2, larger: true, replace: false, current: null } }), 50);
    });
    document.addEventListener('mc:stage', e => window.__stage.push(JSON.parse(e.detail).front));
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      if (d.id !== 'as') return;
      window.__applied.push(d);
      setTimeout(() => send('mc:applied', { id: 'as', run: d.run, ok: true, sent: 2, note: 'entered' }), 50);
    });
    window.__plan = o => send('mc:plan', Object.assign({ id: 'as' }, o));
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.locator('#mc-root [data-card="as"] #mc-as-slot').waitFor();
  const exec = () => page.locator('#mc-root [data-act="exec"]').textContent();
  check(JSON.stringify(await page.evaluate(() => window.__stage)) === '[true]', `the best front's source taken in is staged (${await page.evaluate(() => JSON.stringify(window.__stage))})`);
  check(await exec() === 'Execute (1)', `only the front counts (${await exec()})`);

  // the gallery's plan: two images taken in there beyond the front
  await page.evaluate(() => window.__plan({ ops: [{ kind: 'add', label: 'Add Front (upload)' }, { kind: 'add', label: 'Add Back (upload)' }, { kind: 'add', label: 'Add Medium (upload)' }, { kind: 'reorder', label: 'Reorder covers' }], more: 3 }));
  check(await until(() => exec(), v => v === 'Execute (4)') === 'Execute (4)', `the gallery's changes count (${await exec()})`);
  check(/Add Back \(upload\)/.test(await page.locator('#mc-root .mc-ax-plan').textContent()), 'the card shows the gallery\'s plan');
  // the slot keeps the height Art Station gave it across a repaint
  await page.evaluate(() => { document.getElementById('mc-as-slot').style.height = '345px'; window.__plan({ ops: [{ kind: 'add', label: 'Add Front (upload)' }, { kind: 'add', label: 'Add Back (upload)' }, { kind: 'reorder', label: 'Reorder covers' }], more: 2 }); });
  check(await until(() => page.evaluate(() => document.getElementById('mc-as-slot').style.height), v => v === '345px') === '345px', 'the slot keeps its height across a repaint');

  // a gallery of more than two rows in one column makes the card two columns wide; a small one gives it back
  const wide = () => page.evaluate(() => { const c = document.querySelector('#mc-root [data-card="as"]'); return { span: !!c.closest('.mc-span'), cols: document.querySelectorAll('#mc-root .mc-col').length, w: Math.round(c.getBoundingClientRect().width) }; });
  await page.evaluate(() => window.__plan({ ops: [], more: 0, n: 20, tile: 270 }));
  const w1 = await until(wide, v => v.span);
  await page.evaluate(() => window.__plan({ ops: [], more: 0, n: 2, tile: 270 }));
  const w2 = await until(wide, v => !v.span);
  console.log(JSON.stringify([w1, w2]));
  check(w1.span && w1.cols >= 2 && !w2.span && w1.w > w2.w * 1.6, `twenty images: two columns wide; two: one (${JSON.stringify([w1, w2])})`);

  // the front's source left out: staged out; the gallery's changes alone still run Art Station
  await page.locator('#mc-root [data-card="as"] .mc-pick .mc-tick').first().click();
  check(await until(() => page.evaluate(() => window.__stage.slice(-1)[0]), v => v === false) === false, 'leaving the source out stages the front out');
  await page.evaluate(() => window.__plan({ ops: [{ kind: 'add', label: 'Add Back (upload)' }], more: 1 }));
  check(await until(() => exec(), v => v === 'Execute (1)') === 'Execute (1)', `the gallery's change alone counts (${await exec()})`);
  await page.click('#mc-root [data-act="exec"]');
  const sent = await until(() => page.evaluate(() => window.__applied[0] || null), Boolean);
  check(sent && JSON.stringify(sent.keys) === '[]' && !('extras' in sent), `Execute runs Art Station with no source and no extras (${JSON.stringify(sent)})`);
  await page.screenshot({ path: 'test-results/mc-784-gallery.png' });
});
