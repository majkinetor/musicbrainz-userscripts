// Shared setup for Group Therapy's browser specs.
import { requireLogin, SANDBOX, settled, idle } from '../../../dev/test/harness.mjs';

export const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // the sandbox release most specs edit

// Aborts, and records, every edit submission to the sandbox, so a spec can show it
// only staged changes: check(posts.length === 0, …).
export async function blockEdits(page) {
  const posts = [];
  await page.route(u => u.hostname === 'test.musicbrainz.org' && /\/edit/.test(u.pathname), route => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts.push(route.request().url());
    return route.abort();
  });
  return posts;
}

// The sandbox release's relationship editor, logged in, with Group Therapy running.
export async function openRelEditor(page, inject, release = RELEASE) {
  await page.goto(`${SANDBOX}/release/${release}/edit-relationships`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await settled(page);
  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);
}

// Gives the release an annotation when it has none (550-clear-annotation clears it), so
// a spec that loads the annotation doesn't depend on the order specs run in. A real
// edit on the sandbox, and only when needed.
export async function ensureAnnotation(page, release = RELEASE) {
  await page.goto(`${SANDBOX}/release/${release}/edit_annotation`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  const ta = 'textarea[name="edit-annotation.text"]';
  await page.waitForSelector(ta);
  if ((await page.inputValue(ta)).trim()) return;
  await page.fill(ta, 'Mastering: Annotation Seed Artist 522');
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.click('button:has-text("Enter edit")')]);
}

// ── the text parser (#798: in the page, a row per name) ──────────────────────────
// Opens it (once), sets the pattern when given, pastes the text, and waits for matching.
export async function tpPaste(page, text, pattern) {
  if (!(await page.$('.gt-tp'))) {
    await page.evaluate(() => window.__groupTherapy.openTextParser());
    await page.waitForSelector('.gt-tp');
  }
  if (pattern != null) { await page.fill('.gt-tp-pat', pattern); await page.dispatchEvent('.gt-tp-pat', 'input'); }
  await page.fill('.gt-tp-ta', text);
  await page.dispatchEvent('.gt-tp-ta', 'input');
  await tpSettle(page);
}
// Matching runs by itself after a change (500 ms later); done when nothing says "Matching…".
export async function tpSettle(page) {
  await page.waitForTimeout(700);
  await page.waitForFunction(() => {
    const tp = document.querySelector('.gt-tp');
    return !tp || (!(tp.querySelector('.gt-tp-busy') || {}).textContent && !/Matching…|Searching…/.test(tp.innerText));
  }, null, { timeout: 120000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
// Every credit as the parser reads it: { line, role, entity, matched, crKind, year,
// resolved (the role's name), kind, gid, name, tracks, trackNote, applied }.
export const tpCredits = page => page.evaluate(() => window.__groupTherapy.txpCredits());
// The row of a name.
export const tpRow = (page, name) => page.locator('.gt-tp-erow').filter({ has: page.locator('.gt-tp-ename', { hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
// Picks an entity for a name: an MBID pasted into the row's search is taken at once.
export async function tpPick(page, name, mbid) {
  const row = tpRow(page, name);
  await row.locator('.gt-tp-esrch-q').fill(mbid);
  await row.locator('.gt-tp-esrch-q').press('Enter');
  await page.waitForFunction(([n, g]) => window.__groupTherapy.txpCredits().some(c => c.entity === n && c.gid === g), [name, mbid], { timeout: 30000 });
}
// Apply: the parser closes once the credits are staged.
export async function tpApply(page) {
  await page.click('.gt-tp .gt-cons-apply');
  await page.waitForFunction(() => !document.querySelector('.gt-tp'), null, { timeout: 30000 }).catch(() => {});
}

// window.__rel(item): the relationship behind a .relationship-item, read from React's fiber.
export const installRelReader = page => page.evaluate(() => {
  window.__rel = it => {
    for (const k in it) if (k.startsWith('__reactFiber$')) {
      let f = it[k], d = 0;
      while (f && d++ < 40) { const s = f.memoizedProps && f.memoizedProps.relationship; if (s && 'linkTypeID' in s) return s; f = f.return; }
    }
    return null;
  };
});
