// Find links: per-track links resolved by position, title-guarded, with no ISRC needed.
//
// #458: Spotify. On Random Access Memories (links a Spotify album), each track resolves
// its track URL from the token-free /embed/album/<id> page. Its recordings already carry
// Spotify track links, so they are taken out of the reply to leave the state the
// resolver is for.
// #463: a Cyrillic title ("слезы завтра", track 10 of Flos et Error) collapsed to '' in
// the title guard, so the track got no link though every provider lists the same title
// there. The guard keeps every Unicode letter and number now.
//
// test.musicbrainz.org, with production's data (fixtures/ws-458.json.gz,
// ws-463.json.gz). The providers are live. Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('#458: Spotify track links resolve from the album embed', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: '5000a285-b67e-4cfc-b54b-2b98f1810d2e', replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    edit: j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\//i.test(x.url?.resource || '')); })),
  });
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="sp"]').length > 0, null, { timeout: 20000 });
  await page.click('#ii-links-btn');
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sp"], #ii-modal .ii-tl.absent[data-code="sp"]').length > 0, null, { timeout: 60000 }).catch(() => {});
  const r = await until(() => page.evaluate(() => ({ n: document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sp"]').length, href: (document.querySelector('#ii-modal .ii-tl.new[data-code="sp"]') || {}).href || '' })), r => r.n >= 1);
  check(r.n >= 1, `per-track Spotify links resolve as addable (${r.n})`);
  check(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\//.test(r.href), `a track URL, not the album's ("${r.href}")`);
  await ws.done();
});

test('#463: a Cyrillic title still gets its link', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: '311818ee-cbfd-4ab7-a6c2-bf2873234c02', replay: new URL('./fixtures/ws-463.json.gz', import.meta.url),
    // its recordings have every link by now: take them out, back to the state #463 was about
    edit: j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !x.url); })),
  });
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand').length > 0, null, { timeout: 20000 });
  await page.click('#ii-links-btn');
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new, #ii-modal .ii-tl.absent').length > 0, null, { timeout: 90000 }).catch(() => {});
  const r = await until(() => page.evaluate(() => {
    const row = document.querySelector('#ii-modal tr[data-idx="9"]');   // track 10
    return { links: row ? [...row.querySelectorAll('.ii-tl.new')].map(a => a.dataset.code) : [], total: document.querySelectorAll('#ii-modal .ii-tl.new').length };
  }), r => r.links.length >= 1 && r.total >= 10, { timeout: 60000 });
  check(r.links.length >= 1, `track 10, "слезы завтра", resolves a link (${r.links.join(',') || 'none'})`);
  check(r.total >= 10, `most tracks resolve links (${r.total})`);
  await ws.done();
});

// #661: MusicBrainz's track 16 is "Les Escrocs", Apple's and Spotify's "Les Ecrocs" (a typo, the
// same song at the same position): the title guard turned it away, so only Tidal (by ISRC) linked.
test('#661: a typo in the platform\'s title still gets the link', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: 'b0856abb-5498-4407-b25d-089ce8650fde', replay: new URL('./fixtures/ws-661.json.gz', import.meta.url),
    // back to the state #661 was about, should the links have been added since
    edit: j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/music\.apple\.com|open\.spotify\.com/.test(x.url?.resource || '')); })),
  });
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand').length > 0, null, { timeout: 20000 });
  await page.click('#ii-links-btn');
  const row = await until(() => page.evaluate(() => {
    const tr = [...document.querySelectorAll('#ii-modal tr[data-idx]')].find(r => /Les Escrocs/.test(r.textContent));
    const st = code => { const el = tr && tr.querySelector('.ii-tl[data-code="' + code + '"]:not(.linked)'); return el ? el.className.replace(/\bii-tl\b/, '').trim() : 'none'; };
    return { found: !!tr, am: st('am'), sp: st('sp') };
  }), r => r.found && !/spin|cand/.test(r.am + r.sp), { timeout: 90000 });
  check(row.found, 'track 16, Les Escrocs, is listed');
  check(/\bnew\b/.test(row.am), `Apple Music's "Les Ecrocs" is offered for it (${row.am})`);
  check(/\bnew\b/.test(row.sp), `Spotify's is too (${row.sp})`);
  await ws.done();
});
