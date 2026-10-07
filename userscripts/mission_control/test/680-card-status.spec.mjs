// #680: a provider card shows its provider's state as its step does, in the step's colour (round-7
// mockup, variant C): a 4px stripe on its edge, a tinted header and the state's word in it. A
// waiting card stays plain. Stand-ins: PC has a link to add, AS nothing new; CH waits for Fetch credits.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: a card shows its provider state: stripe, header tint, word', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('credit_hoarder');
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => {
        send('mc:findings', { id: 'pc', run: d.run, findings: [{ key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'new' }] });
        send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1', state: 'unsure', why: 'not larger' }] });
      }, 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.waitForFunction(() => window.__mcTest.found().ch);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root .mc-sect[data-sect="as"][data-st="ok"]', { timeout: 10_000 });
  const read = () => page.evaluate(() => [...document.querySelectorAll('#mc-root .mc-sect[data-sect]')].map(s => {
    const h = s.querySelector('.mc-sect-h'), step = document.querySelector('#mc-root .mc-step[data-step="' + s.dataset.sect + '"]');
    return { id: s.dataset.sect, st: s.dataset.st || '', step: step ? step.className.replace('mc-step ', '') : '', word: (h.querySelector('.mc-st') || {}).textContent || '',
      shadow: getComputedStyle(s).boxShadow, head: getComputedStyle(h).backgroundColor };
  }));
  const tone = v => page.evaluate(v => { const x = document.createElement('i'); x.style.color = 'var(' + v + ')'; document.getElementById('mc-root').append(x); const c = getComputedStyle(x).color; x.remove(); return c; }, v);
  const S = Object.fromEntries((await read()).map(x => [x.id, x]));
  console.log(JSON.stringify(S, null, 1));
  for (const x of Object.values(S).filter(x => x.step)) check(x.st === x.step, `${x.id}: the card's state is its step's (${x.st} / ${x.step})`);
  check(S.tracks && !S.tracks.st, 'the Tracks card has no provider state');
  check(S.pc.word === 'add' && S.pc.shadow.includes((await tone('--mbu-accent')) + ' 4px 0px 0px 0px inset'), `PC: an accent stripe and "add" (${S.pc.shadow})`);
  check(S.pc.head === (await page.evaluate(() => { const x = document.createElement('i'); x.style.background = 'var(--mbu-accent-soft)'; document.getElementById('mc-root').append(x); const c = getComputedStyle(x).backgroundColor; x.remove(); return c; })), `PC: its header is tinted (${S.pc.head})`);
  check(S.as.word === 'ok' && S.as.shadow.includes((await tone('--mbu-ok')) + ' 4px 0px 0px 0px inset'), `AS: a green stripe and "ok" (${S.as.shadow})`);
  check(S.ch.st === 'wait' && S.ch.word === '' && S.ch.shadow.includes('rgba(0, 0, 0, 0) 4px'), `CH waits: no stripe, no word (${S.ch.shadow})`);
  await page.screenshot({ path: 'test-results/mc-680-card-status.png' });
});
