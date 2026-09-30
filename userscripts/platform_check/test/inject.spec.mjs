// The editor side of the + button: Platform Check fills the release editor's External
// links with the queued URLs, and in a background add (#pc-autocommit) submits.
//
// #556 (chaban-mb, majkinetor): "Adding all links in the background randomly fails".
//   · every queued URL lands, the one MusicBrainz rewrites as it adds it (Qobuz's locale)
//     included — that one used to throw and end the run — and then the add submits;
//   · a URL that can't land stays queued for a retry, the ones that did are consumed;
//   · nothing landed → Enter edit is NOT pressed (it used to submit whatever else the
//     page had pending, e.g. Apollo's search-and-replace), the tab doesn't close itself,
//     the queue is kept, and it says why;
//   · a slow editor (the links editor turning up 14 s in) still gets its link;
//   · with Apollo on the page, which renames the field's placeholder, the field is still found.
// #423: a Bandcamp URL whose format includes digital gets both "stream for free" and
//   "purchase for download"; a physical-only one only "stream for free".
//
// test.musicbrainz.org, logged in. Nothing is submitted: a press of Enter edit is counted
// and stopped, and an edit POST would be refused on top of that.
import { test, check, until, requireLogin } from '../../../dev/test/harness.mjs';

const REL = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const EDIT = `https://test.musicbrainz.org/release/${REL}/edit`;
const DEEZER = 'https://www.deezer.com/album/978648191';
const QOBUZ = 'https://www.qobuz.com/us-en/album/as-oneself-arkta-/uqj72odvp0ofm';   // MusicBrainz drops the /us-en

// Opens the editor with `pending` queued, Platform Check loaded as a manager would.
//   withhold  ms the links editor stays unfindable (Infinity: for good)
//   cache     localStorage entries to seed (a provider's scan result)
//   before    (page) => …, after the queue is seeded, before the editor loads
async function openEditor(page, inject, { pending, autocommit = false, withhold = 0, cache = {}, before = null }) {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(({ rel, pending, cache }) => {
    Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('pc:autocommit-close');
    localStorage.setItem('pc:pending:' + rel, JSON.stringify(pending));
    for (const [k, v] of Object.entries(cache)) localStorage.setItem(k, JSON.stringify(v));
  }, { rel: REL, pending, cache });
  const run = { console: [], edits: [] };
  page.on('console', m => { if (/Platform Check/.test(m.text())) run.console.push(m.text()); });
  // an edit submitted (the editor's own previews are not)
  await page.route(/test\.musicbrainz\.org\/(ws\/js\/edit\/create|release\/[0-9a-f-]{36}\/edit)/, r => {
    if (r.request().method() !== 'POST') return r.fallback();
    run.edits.push(r.request().url()); return r.abort();
  });
  await page.addInitScript(withhold => {
    // Enter edit is counted, and stopped before the editor sees it
    window.__submits = 0;
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('#enter-edit, button.submit.positive')) { window.__submits++; e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    if (!withhold) return;
    // the editor still booting: as far as a script can tell, the links editor isn't
    // there yet (its id and the add field's placeholder are withheld)
    document.addEventListener('DOMContentLoaded', () => {
      const RE = /^(?:add (?:another )?link|add another url|paste one or more links)$/i, hidden = [];
      let ed = null;
      const hide = () => {
        const e = document.getElementById('external-links-editor');
        if (e) { ed = e; e.id = 'withheld-links-editor'; }
        document.querySelectorAll('input').forEach(i => { if (RE.test((i.placeholder || '').trim())) { hidden.push([i, i.placeholder]); i.setAttribute('placeholder', 'still loading…'); } });
      };
      const obs = new MutationObserver(hide); obs.observe(document.documentElement, { childList: true, subtree: true }); hide();
      window.__withheld = () => !!ed;
      if (withhold > 0) setTimeout(() => { obs.disconnect(); if (ed) ed.id = 'external-links-editor'; hidden.forEach(([i, p]) => i.setAttribute('placeholder', p)); }, withhold);
    });
  }, withhold === Infinity ? -1 : withhold);   // (Infinity doesn't survive the trip into the page)
  if (before) await before(page);
  await page.goto(EDIT + (autocommit ? '#pc-autocommit' : ''), { waitUntil: 'domcontentloaded' });
  await inject('platform_check');
  return run;
}
// until the run reports how it went; what follows that line (Enter edit, the queue, the
// banner) each test waits for in the state it checks
async function finished(run, page, timeout = 60000) {
  await until(() => run.console.some(l => /inject: \d+\/\d+ link\(s\) landed|NOT submitting|crashed/.test(l)), Boolean, { timeout });
}
const state = page => page.evaluate(rel => ({
  hrefs: [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.href),
  submits: window.__submits,
  closeMarker: sessionStorage.getItem('pc:autocommit-close'),
  queued: JSON.parse(localStorage.getItem('pc:pending:' + rel) || 'null'),
  banner: (document.body.innerText.match(/Platform Check:[^\n]*/) || [null])[0],
}), REL);
const said = (run, re) => run.console.find(l => re.test(l)) || null;

test.use({ gm: { name: 'Platform Check', xhr: 'none' } });

test('#556: every link lands, a rewritten one included, and the add submits', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  const run = await openEditor(page, inject, { autocommit: true, pending: { deezer: DEEZER, tidal: 'https://tidal.com/album/522735526', qobuz: QOBUZ } });
  await finished(run, page);
  const s = await until(() => state(page), s => s.submits === 1 && s.closeMarker === REL && !s.queued);
  for (const id of ['978648191', '522735526', 'uqj72odvp0ofm']) check(s.hrefs.some(h => h.includes(id)), `${id} landed (${s.hrefs.length} rows)`);
  check(!/crashed/.test(s.banner || ''), `no crash (${s.banner})`);
  check(said(run, /inject: 3\/3 link\(s\) landed/), `the run reports it (${said(run, /inject:/)})`);
  check(s.submits === 1 && s.closeMarker === REL, `Enter edit is pressed, and the tab marks itself to close (${s.submits}, ${s.closeMarker})`);
  check(!s.queued, `the queue is consumed (${JSON.stringify(s.queued)})`);
  check(run.edits.length === 0, `nothing reached MusicBrainz (${run.edits.length} edit POSTs)`);
});

test('#556: a link that cannot land stays queued; the rest are consumed', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const run = await openEditor(page, inject, { pending: { deezer: DEEZER, broken: 'not-a-url-at-all' } });
  await finished(run, page);
  const s = await until(() => state(page), s => s.queued && s.queued.broken && !s.queued.deezer);
  check(s.hrefs.some(h => h.includes('978648191')), 'the good one landed');
  check(s.queued && s.queued.broken && !s.queued.deezer, `only the one that didn't land is still queued (${JSON.stringify(s.queued)})`);
});

test('#556: nothing landed — no submit, the queue kept, and it says why', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const run = await openEditor(page, inject, { autocommit: true, withhold: Infinity, pending: { qobuz: QOBUZ } });
  // another change is pending (Apollo's search-and-replace, in the report), so Enter
  // edit is enabled: what it would submit is not Platform Check's
  await page.waitForSelector('#release-editor input#name', { timeout: 30000 });
  await page.evaluate(() => { const i = document.querySelector('#release-editor input#name'); i.value += ' (edited)'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await finished(run, page, 45000);
  const s = await until(() => state(page), s => /not submitting/i.test(s.banner || ''));
  check(await page.evaluate(() => window.__withheld()) && s.hrefs.length === 0, 'the links editor was withheld: no row was made');
  check(s.submits === 0, `Enter edit is not pressed (${s.submits})`);
  check(!s.closeMarker, 'the tab does not mark itself to close, so what happened can be seen');
  check(s.queued && s.queued.qobuz, 'the link stays queued for a retry');
  check(/not submitting/i.test(s.banner || '') && said(run, /NOT submitting/), `it says so, on the page and in the console (${s.banner})`);
});

test('#556: a slow editor still gets its link', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  // 14 s: past the old 10 s budget, inside the 25 s one
  const run = await openEditor(page, inject, { withhold: 14000, pending: { deezer: DEEZER } });
  const t0 = Date.now();
  await finished(run, page, 60000);
  const s = await until(() => state(page), s => s.hrefs.some(h => h.includes('978648191')));
  check(await page.evaluate(() => window.__withheld()) && Date.now() - t0 > 12000, `the links editor really was withheld (${Date.now() - t0} ms to finish)`);
  check(s.hrefs.some(h => h.includes('978648191')), 'the link lands');
  check(said(run, /inject: 1\/1 link\(s\) landed/) && !said(run, /ever appeared/), `and the run says so (${said(run, /inject:/)})`);
});

test('#556: on the "Verifying your browser" page it stands down, the queue untouched', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  // the editor's URL, answered with MusicBrainz's browser check
  await page.route(EDIT, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Verifying your browser</title><noscript>JavaScript is required to access this page</noscript><p>Checking…</p>' }));
  const run = await openEditor(page, inject, { autocommit: true, pending: { deezer: DEEZER } });
  // what it decides, it says: once it has stood down, nothing else follows
  await until(() => said(run, /standing down/));
  const s = await state(page);
  check(said(run, /standing down/), `it recognises the check and says so (${run.console.join(' | ') || 'nothing said'})`);
  check(s.queued && s.queued.deezer && s.submits === 0 && !s.banner, `and does nothing else: the queue kept, no submit, no banner (${JSON.stringify(s)})`);
});

test.describe('with Apollo Editor', () => {
  test.use({ gm: { name: 'Platform Check', xhr: 'none' }, pageErrors: 'ignore' });
  test('#556: Apollo renames the field, and it is still found', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const run = await openEditor(page, inject, {
      pending: { deezer: DEEZER },
      before: p => inject('apollo_editor', { atStart: true, target: p }),   // as String Theory runs it
    });
    await finished(run, page, 60000);
    const s = await until(() => state(page), s => s.hrefs.some(h => h.includes('978648191')));
    const renamed = await until(() => page.evaluate(() => [...document.querySelectorAll('#external-links-editor input[type=url]')].some(i => /paste one or more links/i.test(i.placeholder || ''))));
    check(renamed, 'Apollo renamed the placeholder to "Paste one or more links" (the case reproduces)');
    check(s.hrefs.some(h => h.includes('978648191')), `the link lands all the same (${said(run, /inject:/)})`);
  });
});

test('#423: a digital Bandcamp release gets both link types; a physical-only one gets one', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const BC = 'https://remycaset.bandcamp.com/album/la-minerve';
  const types = async format => {
    const run = await openEditor(page, inject, { pending: { bandcamp: BC }, cache: { [`pc:cache:v2:bandcamp:${REL}`]: { url: BC, tracks: 8, format, source: 'test', _t: Date.now() } } });
    await finished(run, page, 45000);
    if (process.env.DBG) console.log(format, run.console.join('\n'));
    // the types are set before the run reports; a row with none chosen yet is re-read
    return until(() => page.evaluate(() => {
      const row = [...document.querySelectorAll('tr.external-link-item')].find(tr => tr.querySelector('a[href*="remycaset"]'));
      const out = [];
      for (let n = row && row.nextElementSibling; n && n.classList.contains('relationship-item'); n = n.nextElementSibling) {
        const sel = n.querySelector('select.link-type');
        out.push(sel ? sel.value : (n.textContent.match(/stream for free|purchase for download|download for free/) || ['?'])[0]);
      }
      return out;
    }), out => out.length > 0 && out.every(v => v && v !== '?'));
  };
  const digital = await types('Digital, CD');
  check(digital[0] === '85' && digital[1] === '74', `digital: "stream for free" (85) and "purchase for download" (74) (${digital})`);
  const vinyl = await types('Vinyl');
  check(vinyl.length === 1 && vinyl[0] === '85', `physical only: just "stream for free" (${vinyl})`);
});

test('#639: a YouTube Music album link lands with its link type set', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const YTM = 'https://music.youtube.com/playlist?list=OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c';
  const run = await openEditor(page, inject, { pending: { ytmusic: YTM } });
  await finished(run, page);
  const s = await until(() => state(page), s => s.hrefs.some(h => h.includes('OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c')));
  const typed = await page.evaluate(() => {
    const ed = document.getElementById('external-links-editor') || document.body;
    const row = [...ed.querySelectorAll('tr.external-link-item')].find(tr => /OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3/.test(tr.innerHTML));
    const sel = row && row.parentElement.querySelector('select.link-type');
    return { text: row ? row.parentElement.innerText.replace(/\s+/g, ' ').slice(0, 300) : null, select: sel ? sel.value : null, unset: /Please select a link type/i.test(ed.innerText) };
  });
  console.log(JSON.stringify({ typed, report: said(run, /inject:/), lines: run.console.filter(l => /music\.youtube/.test(l)) }, null, 1));
  check(s.hrefs.some(h => h.includes('OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c')), 'the link lands, its list id intact');
  check(!typed.unset, `with a link type, not "Please select a link type" (${JSON.stringify(typed)})`);
});
