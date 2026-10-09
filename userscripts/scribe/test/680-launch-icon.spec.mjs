// #680: Scribe's corner launcher wears the script's own icon, 34px with no disc, like the other corner
// launchers (Mission Control, Fusion, Falcon), in place of its stroke glyph on a shadowed disc. With the
// icon no longer recoloured, a session in progress shows as a green ring round it.
//
// test.musicbrainz.org, a release's edit page, nothing edited. The launcher shows only while the extedit
// helper answers, so a stand-in helper runs on a spare port.
import { createServer } from 'node:http';
import { test, check, until, idle, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const PORT = 17989;
test.use({ gm: { name: 'Scribe', values: { ee_port: PORT } } });

test('#680: Scribe\'s launcher shows its icon, no disc; a session rings it green', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, info) => {
  // /ping and /open answer; /result (the long poll for the editor's save) never does, so the session stays open
  const helper = createServer((req, res) => { if (req.url.startsWith('/result')) return; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); });
  await new Promise(r => helper.listen(PORT, '127.0.0.1', r));
  try {
    await page.goto(`${SANDBOX}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await idle(page);
    await inject('scribe');
    await page.waitForSelector('#scribe-launcher img', { state: 'visible', timeout: 20000 });
    const read = () => page.evaluate(() => {
      const b = document.getElementById('scribe-launcher'), img = b.querySelector('img'), r = img.getBoundingClientRect(), cs = getComputedStyle(b);
      return { svg: b.querySelector('svg') != null, src: img.src.slice(0, 26), loaded: img.complete && img.naturalWidth > 0, w: Math.round(r.width), bg: cs.backgroundColor, shadow: cs.boxShadow };
    });
    const idleL = await read();
    console.log(JSON.stringify(idleL));
    check(!idleL.svg && idleL.src === 'data:image/svg+xml;base64,' && idleL.loaded, `the icon, not the glyph (${JSON.stringify(idleL)})`);
    check(idleL.w === 34, `34px (${idleL.w})`);
    check(/rgba\(0, 0, 0, 0\)|transparent/.test(idleL.bg) && idleL.shadow === 'none', `no disc at rest (${idleL.bg}, ${idleL.shadow})`);
    const box = await page.evaluate(() => { const r = document.getElementById('scribe-launcher').getBoundingClientRect(); return { x: r.left - 10, y: r.top - 10, width: r.width + 20, height: r.height + 20 }; });
    await info.attach('idle', { body: await page.screenshot({ clip: box }), contentType: 'image/png' });

    await page.waitForFunction(() => window.__scribe && window.__scribe.startSession, null, { timeout: 20000 });
    await page.evaluate(() => window.__scribe.startSession());
    const on = await until(read, l => /46, 158, 91/.test(l.shadow), { timeout: 10000 });
    check(/46, 158, 91/.test(on.shadow), `a session rings it green (${on.shadow})`);
    await info.attach('session', { body: await page.screenshot({ clip: box }), contentType: 'image/png' });
  } finally {
    helper.closeAllConnections(); await new Promise(r => helper.close(r));
  }
});
