// #544 follow-up (majkinetor): "When creating in the background, it doesn't click
// Enter in 2nd tab."
//
// A seeded /<kind>/create URL only pre-fills the form. In the foreground you see it
// and press Enter; a background tab just sits there, so the entity is never created
// and the text parser waits out its full ten minutes for a post-back that can't come.
// So the create page presses Enter itself, but only on a create Group Therapy opened.
//
// test.musicbrainz.org, with every POST aborted: it must not submit a create page the
// user opened themselves, a stale one, one for another entity type, or one it already
// pressed once; and it must press it on its own. The real create, read back from
// MusicBrainz, is 598-two-background-creates.
import { test, check, requireLogin, SANDBOX, idle, until } from '../../../dev/test/harness.mjs';

// the pending record has to survive a navigation
test.use({ gm: { name: 'Group Therapy', persist: 'tabs' } });

test('a create page submits itself only when Group Therapy opened it', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const TOKEN = 'tok544' + Math.random().toString(36).slice(2, 7);
  const NAME = 'GT Probe ' + Date.now().toString(36);
  const seedUrl = extra => `${SANDBOX}/artist/create?` + new URLSearchParams(Object.assign({
    'edit-artist.name': NAME,
    'edit-artist.sort_name': NAME,
    'edit-artist.type_id': '1',
    'edit-artist.edit_note': 'Group Therapy probe for #544',
  }, extra)).toString();
  const goto = async url => {
    for (let a = 1; ; a++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; }
      catch (e) { if (a >= 4) throw e; await page.waitForTimeout(4000); }
    }
  };
  const setPending = rec => page.evaluate(r => window.GM_setValue('gt:pendingCreate', JSON.stringify(r)), rec);
  const getPending = () => page.evaluate(() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return null; } });

  // every POST aborted (the create form posts to /artist/create, not an /edit URL)
  let posts = [];
  await page.route(u => u.hostname === 'test.musicbrainz.org', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts.push(route.request().url());
    return route.abort();
  });
  await goto(`${SANDBOX}/`);
  await requireLogin(page);
  // what the create page decided: it says so in the console, every time
  let said = [];
  page.on('console', m => { const t = m.text(); if (/\[Group Therapy\] background create:/.test(t)) said.push(t); });
  const decided = () => until(() => said.find(t => /leaving (it|this form) alone|standing down|pressing "Enter edit"|gave up/.test(t)), Boolean, { timeout: 30000 });

  const cases = [
    ['no pending create at all', null, seedUrl({ x_gtcreate: TOKEN })],
    ['a create the user opened by hand (no x_gtcreate)', { kind: 'artist', token: TOKEN, ts: Date.now() }, seedUrl({})],
    ['a different token', { kind: 'artist', token: 'someoneelse', ts: Date.now() }, seedUrl({ x_gtcreate: TOKEN })],
    ['a stale pending create (20 min old)', { kind: 'artist', token: TOKEN, ts: Date.now() - 20 * 60 * 1000 }, seedUrl({ x_gtcreate: TOKEN })],
    ['one it has already pressed once', { kind: 'artist', token: TOKEN, ts: Date.now(), submitted: true }, seedUrl({ x_gtcreate: TOKEN })],
    ['a pending create for a different entity type', { kind: 'label', token: TOKEN, ts: Date.now() }, seedUrl({ x_gtcreate: TOKEN })],
  ];
  for (const [what, pending, url] of cases) {
    posts = [];
    await goto(`${SANDBOX}/`);
    if (pending) await setPending(pending); else await page.evaluate(() => window.GM_deleteValue('gt:pendingCreate'));
    said = [];
    await goto(url);
    await inject('group_therapy');
    await decided();   // it has decided (standing down), so no press can follow
    await idle(page);
    check(posts.length === 0, `does not submit: ${what}` + (posts.length ? ' — POSTed ' + posts[0] : ''));
  }

  // the case it should act on (the POST is still aborted, so nothing is created)
  posts = [];
  await goto(`${SANDBOX}/`);
  await setPending({ kind: 'artist', token: TOKEN, ts: Date.now() });
  said = [];
  await goto(seedUrl({ x_gtcreate: TOKEN }));
  await inject('group_therapy');
  await until(() => posts.length, n => n > 0, { timeout: 30000 });   // Enter edit is pressed once the form is ready
  await idle(page);
  check(posts.length === 1, `it presses Enter on the create it opened itself (${posts.length} POST)`);
  // read the record from a real page: the aborted POST leaves an error document
  // behind, where localStorage throws and would read as "no record"
  await goto(`${SANDBOX}/`);
  // since #598 the store is a list (an old single record is still read)
  const after = await getPending();
  const rec = Array.isArray(after) ? after.find(r => r && r.token === TOKEN) : after;
  check(rec && rec.submitted === true, `and marks it submitted, so a duplicate-check page can't make it press again (${JSON.stringify(after)})`);
});
