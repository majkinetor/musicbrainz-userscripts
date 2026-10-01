// #653: String Theory and a standalone Platform Check both installed ran two copies on one page.
// They build the same element ids, so each copy's settings window filled in the other's
// checkboxes (all shown off) and the rows jumped between the two copies' compact rules.
//
// majkinetor: "disable copy that has lower version without any info (except in log of active
// copy). For all scripts." So one copy runs, the newer one, and the other says nothing on the
// page. The decision is made at once (no script starts late): when the older copy starts
// first, it runs this page and the newer one takes over from the next page load.
//
// Two copies with different versions are the same file run twice, each seeing its own
// GM_info (a wrapper shadows it), as each userscript-manager sandbox does.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

const PAGE = `${SANDBOX}/release/ec116461-5b0d-4c98-bb44-a4de5de63076`;
const as = (name, version) => code => `(function (GM_info) {\n${code}\n})({ script: { name: ${JSON.stringify(name)}, version: ${JSON.stringify(version)} } });`;
const OLD = as('String Theory*', '2026.9.1'), NEW = as('Platform Check', '2026.10.1.120000');

async function open(page) {
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
}
const state = page => page.evaluate(() => ({
  runs: document.documentElement.getAttribute('data-mbu-run-platform_check'),
  panels: document.querySelectorAll('#mb-pc-panel').length,
  toast: document.getElementById('mbu-toast')?.textContent || '',
  note: localStorage.getItem('mbu-newer-platform_check'),
}));

test('the newer copy runs, the older one stays off without a word', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const said = [];
  page.on('console', m => said.push(m.text()));

  // newer first: the older copy stays off
  await open(page);
  await page.evaluate(() => localStorage.removeItem('mbu-newer-platform_check'));
  await inject('platform_check', { transform: NEW });
  await page.waitForSelector('#mb-pc-panel');
  await inject('platform_check', { transform: OLD });
  let s = await state(page);
  check(s.runs === 'standalone v2026.10.1.120000' && s.panels === 1, `newer first: the newer copy runs, one panel (${JSON.stringify(s)})`);
  check(!/installed twice/.test(s.toast), `no toast on the page ("${s.toast}")`);
  check(await until(() => said.some(t => /installed twice: standalone v2026\.10\.1\.120000 runs, String Theory v2026\.9\.1 is switched off/.test(t)), Boolean),
    `the running copy logs it (${said.filter(t => /installed twice/.test(t)).join(' | ')})`);

  // older first: it keeps this page, the newer one notes itself for the next load
  await open(page);
  await inject('platform_check', { transform: OLD });
  await page.waitForSelector('#mb-pc-panel');
  await inject('platform_check', { transform: NEW });
  s = await state(page);
  check(s.runs === 'String Theory v2026.9.1' && s.panels === 1 && /2026\.10\.1\.120000/.test(s.note || ''), `older first: it keeps this page, the newer copy leaves a note (${JSON.stringify(s)})`);

  // the next load: the older copy finds the note and steps aside, whichever starts first
  await open(page);
  await inject('platform_check', { transform: OLD });
  await inject('platform_check', { transform: NEW });
  await page.waitForSelector('#mb-pc-panel');
  s = await state(page);
  check(s.runs === 'standalone v2026.10.1.120000' && s.panels === 1, `next load: the newer copy runs (${JSON.stringify(s)})`);
  check(!/installed twice/.test(s.toast), 'still no toast');

  // the newer copy is uninstalled: the older one clears the stale note and runs again from the next load
  await open(page);
  await inject('platform_check', { transform: OLD });
  await page.evaluate(() => window.dispatchEvent(new Event('load')));
  const cleared = await until(() => page.evaluate(() => localStorage.getItem('mbu-newer-platform_check')), v => v === null, { timeout: 8000 });
  check(cleared === null, 'a note whose copy never starts is cleared');
  await open(page);
  await inject('platform_check', { transform: OLD });
  await page.waitForSelector('#mb-pc-panel');
  s = await state(page);
  check(s.runs === 'String Theory v2026.9.1', `the load after, the older copy runs again (${JSON.stringify(s)})`);

  // settings still show their stored values (the original symptom)
  await page.evaluate(() => document.getElementById('mb-token-setup-btn').click());
  const boxes = await until(() => page.evaluate(() => [...document.querySelectorAll('#mb-provider-modal-card input[type=checkbox]')].filter(i => i.offsetParent).map(i => i.id + '=' + i.checked)), b => b.length > 0);
  check(boxes.length === new Set(boxes.map(b => b.split('=')[0])).size, `each setting has one checkbox (${boxes.join(', ')})`);
});
