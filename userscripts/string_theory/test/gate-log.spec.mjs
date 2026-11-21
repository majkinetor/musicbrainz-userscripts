// The Gate log window: requests grouped from the gate's trace events, one lane per tab, the count,
// and the window kept like the Activity log (minimised, and open again after a reload).
import { test, check, until, attachShot, SANDBOX } from '../../../dev/test/harness.mjs';

const seed = page => page.evaluate(() => {
  const now = Date.now(), ev = (t, e, x) => Object.assign({ t: now - t, s: 'ISRC Scout', e, l: 'GET /ws/2/recording?isrc', b: 1 }, x);
  localStorage.setItem('mbu:mb-gate-trace:aaaa1111', JSON.stringify([
    ev(20000, 'book', { w: 400 }), ev(19600, 'start', { w: 400 }), ev(19100, 'answer', { st: 200, lim: 300, rem: 280, who: 'ws' }),
    ev(15000, 'start', { l: 'GET /ws/2/release/x' }), ev(14500, 'answer', { l: 'GET /ws/2/release/x', st: 503, hold: 3000, hot: 1 }),
    ev(14400, 'book', { l: 'GET /ws/2/release/x', w: 3000, why: 'hold', re: 1 }), ev(11400, 'start', { l: 'GET /ws/2/release/x' }),
    ev(11000, 'answer', { l: 'GET /ws/2/release/x', st: 200 }),
  ]));
  localStorage.setItem('mbu:mb-gate-trace:bbbb2222', JSON.stringify([
    { t: now - 9000, s: 'Credit Hoarder', e: 'start', l: 'GET /ws/2/artist/y', b: 0 }, { t: now - 8000, s: 'Credit Hoarder', e: 'error', l: 'GET /ws/2/artist/y', b: 0, err: 'network error' },
  ]));
});
const openLog = async (page, inject) => {
  await page.locator('body:not([hidden])').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
  await page.keyboard.type('gate log');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#st-gate', { timeout: 10000 });
};

test.describe('gate log', () => {
  test.use({ gm: { name: 'String Theory', persist: true, values: { 'string_theory.off': ['event_horizon'] } } });
  test('groups requests into lanes, counts them, and keeps its window', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await seed(page);
    await inject('string_theory');
    await openLog(page, inject);
    const n = await page.textContent('#st-gate .st-gate-n');
    check(/^\d+ requests$/.test(n) && parseInt(n) >= 3, `the title counts the requests (${n})`);
    const lanes = await page.$$eval('#st-gate-lanes .st-gl-lane', l => l.length);
    check(lanes >= 2, `one lane per tab (${lanes})`);
    check(await page.$$eval('#st-gate-lanes .st-gl-band', l => l.length) >= 1, 'the hold is shaded');
    const pills = await page.$$eval('#st-gate .st-gate-pill', l => l.map(x => x.textContent));
    check(pills.includes('ok after 2 tries'), `the retried request is one row (${pills.join(', ')})`);
    check(pills.includes('error'), 'the failed request shows its error');
    await page.click('#st-gate tr.rq');
    check(await page.$('#st-gate tr.steps'), 'a click shows the steps');
    await page.click('#st-gate tr.rq', { button: 'right' });
    const rq = await page.$$eval('#st-gate tr.rq', l => l.length), steps = await page.$$eval('#st-gate tr.steps', l => l.length);
    check(steps === rq, `a right click shows the steps of every row (${steps} of ${rq})`);
    await page.click('#st-gate tr.rq', { button: 'right' });
    check(!(await page.$('#st-gate tr.steps')), 'a second right click hides them all');
    await page.hover('#st-gate-lanes');
    const bar = await page.$('#st-gate-lanes .st-gl-lane *');
    await page.waitForTimeout(1200);
    check(bar && await bar.evaluate(e => e.isConnected), 'the lanes do not redraw under the mouse');
    await page.click('#st-gate .st-gate-seg [data-m=bad]');
    const bad = await page.$$eval('#st-gate tr.rq .st-gate-pill', l => l.map(x => x.classList.contains('bad') ? 'bad' : x.textContent));
    check(bad.length >= 1 && bad.every(x => x === 'bad'), `Failed shows only failed requests (${bad.join(', ')})`);
    await page.click('#st-gate .st-gate-seg [data-m=all]');
    await attachShot(testInfo, page.locator('#st-gate'), 'gate log');
    if (process.env.SHOT) await page.locator('#st-gate').screenshot({ path: process.env.SHOT });
    await page.click('#st-gate .mbu-logpop-min');
    check(await page.$('#st-gate.min'), 'it minimises');
    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await until(() => page.$('#st-gate.min'), x => !!x, { timeout: 10000 });
    await page.click('#st-gate .mbu-logpop-min');
    check(!(await page.$('#st-gate.min')), 'it comes back minimised after a reload, and restores');
    await page.click('#st-gate .mbu-logpop-x');
    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await page.waitForTimeout(1500);
    check(!(await page.$('#st-gate')), 'once closed, it stays closed');
  });
});

test.describe('gate log, a bad saved window', () => {
  // a place off screen, a size too big and the minimised bar: an open from the palette still shows the window
  test.use({ gm: { name: 'String Theory', persist: true, values: { 'string_theory.off': ['event_horizon'], 'st:gatelog-win': JSON.stringify({ open: false, min: true, left: '5000px', top: '-900px', w: '9000px', h: '9000px' }) } } });
  test('opens on screen and whole', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await openLog(page, inject);
    const r = await page.evaluate(() => { const b = document.getElementById('st-gate').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight, min: document.getElementById('st-gate').classList.contains('min') }; });
    check(!r.min, 'an open from the palette is not the minimised bar');
    check(r.l >= 0 && r.t >= 0 && r.l + r.w <= r.vw && r.t + r.h <= r.vh, `it is on screen (${JSON.stringify(r)})`);
  });
});

test.describe('gate log with Event Horizon', () => {
  // Event Horizon swaps the body: a window restored at start must not stay in the old one
  test.use({ gm: { name: 'String Theory', persist: true, values: {} } });
  test('stays on top of Event Horizon after a reload', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForTimeout(3000);
    await openLog(page, inject);
    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await until(() => page.$('#st-gate'), x => !!x, { timeout: 10000 });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => {
      const g = document.getElementById('st-gate'), b = g.getBoundingClientRect();
      return { w: b.width, h: b.height, top: g.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) };
    });
    check(r.w > 100 && r.h > 60 && r.top, `the window shows and is on top (${JSON.stringify(r)})`);
  });
});
