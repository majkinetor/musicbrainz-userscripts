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
