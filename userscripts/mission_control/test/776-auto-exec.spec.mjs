// #776: "…and Execute once the probe has finished": after a consolidation opens Mission Control, Execute
// runs by itself once every provider has answered (the second ask after the album links changed
// included), after a countdown on the Execute button that a click cancels. Off by default, greyed out
// while "After saving a consolidated release" is off, and never on a Mission Control opened by hand or by an
// update of a release MusicBrainz already has (nothing was consolidated). The countdown's seconds are a setting, 10 by default.
// Stand-in PC and IS providers answer the probe and pretend to apply: nothing is written.
import { test, check, until } from '../../../dev/test/harness.mjs';

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)
const SETTINGS = { consExec: true, consExecS: 5, reloadAfter: false, v: 2 };

// providers that answer discover, probe and apply; IS answers late, so the countdown has to wait for it
async function standIns(page, { isDelay = 1200 } = {}) {
  await page.evaluate(isDelay => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applied = [];
    const hello = () => {
      send('mc:provider', { id: 'pc', name: 'pc', version: 1, capabilities: ['probe', 'apply'] });
      send('mc:provider', { id: 'is', name: 'is', version: 1, capabilities: ['probe', 'apply'] });
    };
    document.addEventListener('mc:discover', hello);
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      if (d.only.includes('pc')) setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings: [{ key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', barcode: '0000000000017', state: 'new' }], barcode: '0000000000017' }), 50);
      if (d.only.includes('is')) setTimeout(() => send('mc:findings', { id: 'is', run: d.run, findings: [] }), isDelay);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      window.__applied.push({ id: d.id, at: Date.now() });
      setTimeout(() => send('mc:applied', { id: d.id, run: d.run, ok: true, sent: 1, note: 'stand-in' }), 20);
    });
  }, isDelay);
}
// the note Add release leaves for the saved release, known by its title; an update names the release instead
async function afterConsolidation(page, inject, { update = false } = {}) {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await page.evaluate(([r, update]) => sessionStorage.setItem('mc.after', JSON.stringify(update
    ? { created: Date.now(), mbid: r, title: '', ticks: { is: true, as: true, pc: true }, compare: true }
    : { created: Date.now(), title: document.querySelector('.releaseheader h1').textContent, tracks: 1, isrcs: [], ticks: { is: true, as: true, pc: true } })), [RELEASE, update]);
  await standIns(page);
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.waitForSelector('#mc-root');
}
const label = page => page.locator('#mc-root [data-act="exec"]').textContent();

test.describe('on', () => {
  test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify(SETTINGS) } } });

  test('#776: after a consolidation, Execute runs once the probe has finished, after a countdown', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const t0 = Date.now();
    await afterConsolidation(page, inject);
    const counting = await until(() => label(page), t => /^Executing 1 in \d… \(click to cancel\)$/.test(t || ''), { timeout: 8000 });
    check(!!counting, `the button counts down (${counting})`);
    const isDone = await page.evaluate(() => (window.__mcTest.results().is || {}).state);
    check(isDone === 'done', `only once the late provider has answered (${isDone})`);
    check(await page.evaluate(() => window.__applied.length) === 0, 'nothing applied during the countdown');
    await page.screenshot({ path: 'test-results/mc-776-countdown.png', clip: await page.locator('#mc-root .mc-hdr').boundingBox() });
    const applied = await until(() => page.evaluate(() => window.__applied), a => a.length > 0, { timeout: 10000 });
    check(applied.length === 1 && applied[0].id === 'pc', `then Execute applies the selection (${JSON.stringify(applied)})`);
    check(applied[0].at - t0 >= 5000, `after the 5 s countdown (${applied[0].at - t0} ms after load)`);
  });

  test('#776: a click on the button cancels the countdown, and doesn\'t execute', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await afterConsolidation(page, inject);
    await until(() => label(page), t => /^Executing/.test(t || ''), { timeout: 8000 });
    await page.click('#mc-root [data-act="exec"]');
    check(await label(page) === 'Execute (1)', `the button is Execute again (${await label(page)})`);
    await page.waitForTimeout(6500);
    check(await page.evaluate(() => window.__applied.length) === 0, 'nothing is applied');
    await page.click('#mc-root [data-act="exec"]');
    const applied = await until(() => page.evaluate(() => window.__applied.length), n => n > 0, { timeout: 5000 });
    check(applied === 1, 'a second click executes');
  });

  test('#776: an update of a release MusicBrainz already has doesn\'t execute by itself', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await afterConsolidation(page, inject, { update: true });
    await until(() => page.evaluate(() => (window.__mcTest.results().is || {}).state), s => s === 'done', { timeout: 8000 });
    await page.waitForTimeout(3000);
    check(await label(page) === 'Execute (1)', `no countdown (${await label(page)})`);
    check(await page.evaluate(() => window.__applied.length) === 0, 'nothing is applied');
  });

  test('#776: Mission Control opened by hand never executes by itself', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content table.medium');
    await standIns(page, { isDelay: 100 });
    await inject('mission_control', { waitFor: '__mcTest' });
    await page.click('#mc-launch');
    await until(() => page.evaluate(() => (window.__mcTest.results().is || {}).state), s => s === 'done', { timeout: 8000 });
    await page.waitForTimeout(3000);
    check(await label(page) === 'Execute (1)', `no countdown (${await label(page)})`);
    check(await page.evaluate(() => window.__applied.length) === 0, 'nothing is applied');
  });
});

test.describe('settings', () => {
  test.use({ gm: { name: 'Mission Control' } });

  test('#776: off by default, under the consolidation setting and greyed out while that one is off', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content table.medium');
    await inject('mission_control', { waitFor: '__mcTest' });
    check((await page.evaluate(() => window.__mcTest.settings())).consExec === false, 'off by default');
    await page.click('#mc-launch', { button: 'right' });
    const sub = page.locator('.mc-cfg input[data-k="consExec"]');
    check(await sub.isEnabled(), 'enabled while the consolidation setting is on');
    const lines = await page.locator('.mc-cfg label').evaluateAll(n => n.map(x => Math.round(x.getBoundingClientRect().height)));
    check(lines.slice(0, 3).every(h => h < 30), `the settings fit one line each (${JSON.stringify(lines)})`);
    await page.locator('.mc-cfg').screenshot({ path: 'test-results/mc-776-settings.png' });
    await page.locator('.mc-cfg input[data-k="consAfter"]').uncheck();
    check(await sub.isDisabled(), 'greyed out once it is off');
    await page.locator('.mc-cfg input[data-k="consAfter"]').check();
    await sub.check();
    check((await page.evaluate(() => window.__mcTest.settings())).consExec === true, 'ticking it stores it');
    check((await page.evaluate(() => window.__mcTest.settings())).consExecS === 10, 'its countdown is 10 s by default');
  });
});
