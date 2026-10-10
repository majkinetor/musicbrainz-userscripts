// The shared activity log (mbuLog, dev/ui/ui-components.mjs), X12 of #623: Apollo, Art
// Station and Fusion each had their own copy, with a buffer that grew for the whole
// session and a window that rebuilt its whole list on every new line. On a blank page,
// nothing fetched.
import { test, check, frames, until } from '../test/harness.mjs';
import { UI_CSS, UI_JS } from './ui-components.mjs';

test.use({ profile: 'fresh', gm: false });

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addStyleTag({ content: UI_CSS });
  await page.addScriptTag({ content: UI_JS + `
    window.__store = new Map();
    window.mk = (max) => mbuLog({ name: 'Test', version: '1', key: 'k', max,
      load: k => window.__store.get(k), save: (k, v) => window.__store.set(k, v) });` });
});

test('keeps the last lines only, and says how many went before them', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(() => {
    const L = mk(20);
    for (let i = 0; i < 50; i++) (i % 5 ? L.info : L.warn)('line ' + i);
    L.err(new Error('boom'));
    return { lines: L.lines(), md: L.markdown(), counts: L.counts() };
  });
  check(r.lines.length >= 20 && r.lines.length <= 22, `the buffer is capped near 20 (${r.lines.length})`);
  check(/line 49/.test(r.lines.at(-2)) && /ERR  boom/.test(r.lines.at(-1)), 'the newest lines are the ones kept');
  const kept = r.lines.filter(l => /WARN/.test(l)).length;
  check(r.counts.warn === kept && r.counts.error === 1, `the counts are of the lines kept (${JSON.stringify(r.counts)}, ${kept} warnings kept)`);
  check(/\(\d+ earlier lines not kept\)/.test(r.md), 'the Markdown says lines were dropped');
  check(/^<details><summary>Test v1 — session log \(\d+ warnings?, 1 error\)<\/summary>/.test(r.md) && r.md.includes('```log\n'), 'the Markdown keeps its shape');
});

test('an open window appends each line instead of rebuilding the list', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => { window.L = mk(20); for (let i = 0; i < 5; i++) L.info('before ' + i); L.open(); });
  const rows = () => page.evaluate(() => document.querySelectorAll('#mbu-logpop .mbu-log-li').length);
  check(await rows() === 5, 'the window shows the lines logged before it opened');
  // a mark on an existing row: a rebuilt list would drop it
  await page.evaluate(() => { document.querySelector('#mbu-logpop .mbu-log-li:last-child').dataset.mark = '1'; });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) L.warn('after ' + i); });
  await frames(page);
  const r = await page.evaluate(() => ({
    rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length,
    marked: !!document.querySelector('#mbu-logpop .mbu-log-li[data-mark="1"]'),
    badge: document.querySelector('#mbu-logpop .mbu-log-badge').textContent,
    last: document.querySelector('#mbu-logpop .mbu-log-li:last-child').className,
  }));
  check(r.rows === 8 && r.marked, `new lines are appended, the old rows stay (${r.rows} rows, mark kept: ${r.marked})`);
  check(r.badge === '(8) · 3⚠ 0✖', `the badge follows (${r.badge})`);
  check(/mbu-log-warn/.test(r.last), 'a line keeps its severity class');
  // past the cap the window drops its oldest rows too
  await page.evaluate(() => { for (let i = 0; i < 40; i++) L.info('more ' + i); });
  await frames(page);
  const n = await page.evaluate(() => ({ rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length, kept: L.lines().length }));
  check(n.rows === n.kept, `the window holds what the buffer holds (${n.rows} rows, ${n.kept} lines)`);
});

test('the window escapes text, links URLs, minimises, closes on Escape and remembers', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => { window.L = mk(); L.info('<b>bold</b> see https://musicbrainz.org/x.'); L.open(); });
  const m = await page.evaluate(() => {
    const el = document.querySelector('#mbu-logpop .mbu-log-m');
    return { b: !!el.querySelector('b'), href: el.querySelector('a') && el.querySelector('a').getAttribute('href'), text: el.textContent };
  });
  check(!m.b && m.text.startsWith('<b>bold</b>'), 'logged markup shows as text');
  check(m.href === 'https://musicbrainz.org/x', `a URL is a link, without its trailing full stop (${m.href})`);
  await page.click('#mbu-logpop .mbu-logpop-min');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#mbu-logpop .mbu-log-list')).display === 'none'), 'Minimise hides the list');
  check(await page.evaluate(() => JSON.parse(window.__store.get('k')).min === true), 'and is remembered');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.getElementById('mbu-logpop') && !L.isOpen()), 'Escape closes it');
  check(await page.evaluate(() => { L.reopen(); return !document.getElementById('mbu-logpop'); }), 'closed, it is not reopened on the next load');
  const back = await page.evaluate(() => { L.open(); L.close(); window.__store.set('k', JSON.stringify({ open: true })); const L2 = mk(); L2.reopen(); return !!document.getElementById('mbu-logpop'); });
  check(back, 'left open, it is');
});

test('Clear empties the log; 20000 lines are kept by default', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(async () => {
    const L = mk();   // no max: the default
    for (let i = 0; i < 2500; i++) L.info('line ' + i);
    L.warn('careful');
    const kept = L.lines().length;
    L.open();
    const rowsBefore = document.querySelectorAll('#mbu-logpop .mbu-log-li').length;
    document.querySelector('#mbu-logpop .mbu-logpop-clear').click();
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
    const after = { lines: L.lines().length, counts: L.counts(), rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length, empty: !!document.querySelector('#mbu-logpop .mbu-log-empty'), md: L.markdown() };
    L.info('after the clear');
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
    return { kept, rowsBefore, after, rowsNow: document.querySelectorAll('#mbu-logpop .mbu-log-li').length };
  });
  check(r.kept === 2501 && r.rowsBefore === 2501, `2501 lines, all kept and shown (the old default kept 2000): ${r.kept}, ${r.rowsBefore} rows`);
  check(r.after.lines === 0 && r.after.rows === 0 && r.after.empty && r.after.counts.warn === 0, `Clear empties the lines, the rows and the counts (${JSON.stringify({ ...r.after, md: undefined })})`);
  check(/no activity logged/.test(r.after.md) && !/not kept/.test(r.after.md), 'and the Markdown says there is nothing, without an "earlier lines" note');
  check(r.rowsNow === 1, `logging goes on after a clear (${r.rowsNow} row)`);
});

test('a toast with an action is clickable, runs it, and closes', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(async () => {
    let ran = 0;
    const el = mbuToast('⚠ something happened', { action: { label: 'Copy log', onClick: () => { ran++; } } });
    const btn = el.querySelector('.mbu-toast-btn');
    const clickable = getComputedStyle(el).pointerEvents !== 'none';
    btn.click();
    await new Promise(z => setTimeout(z, 1100));
    const plain = mbuToast('plain');
    return { label: btn.textContent, clickable, ran, closed: !el.classList.contains('mbu-toast-on') || el.textContent === 'plain', plainInert: getComputedStyle(plain).pointerEvents === 'none', plainNoBtn: !plain.querySelector('.mbu-toast-btn') };
  });
  check(r.label === 'Copy log' && r.clickable, `the toast carries the button and takes clicks (${JSON.stringify(r)})`);
  check(r.ran === 1 && r.closed, 'the button runs its action, and the toast closes');
  check(r.plainInert && r.plainNoBtn, 'a toast without an action stays click-through, with no button');
});

// #697: a line can carry a category; the window filters by level and by category,
// and shows the filter row only when there is something to choose between.
test('categories: tagged lines, a filter row only when needed, one-click filters', { tag: ['@unit'] }, async ({ page }) => {
  const vis = () => page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').length);
  const row = () => page.evaluate(() => { const f = document.querySelector('#mbu-logpop .mbu-log-f'); return f.hidden ? null : [...f.querySelectorAll('.mbu-log-fb')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' '); });
  await page.evaluate(() => { window.L = mk(); L.info('plain'); L.ok('done'); L.open(); });
  check(await row() === null, 'info and ok alone: no filter row');
  await page.evaluate(() => { L.cat('Spotify').info('sp one'); L.cat('Spotify').warn('sp two'); });
  check(await row() === 'warn info', `a second level brings the level filters, ok counted as info (${await row()})`);
  await page.evaluate(() => { L.cat('Deezer').err('dz'); });
  check(await row() === 'error warn info Spotify Deezer', `a second category brings the category filters (${await row()})`);
  check(await page.evaluate(() => L.cat('Spotify') === L.cat('Spotify')), 'the same category gives the same logger');
  const tag = await page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].map(d => d.querySelector('.mbu-log-c')?.textContent || '-').join(','));
  check(tag === '-,-,Spotify,Spotify,Deezer', `rows carry their category tag (${tag})`);
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Spotify"]');
  check(await vis() === 2, 'Spotify: only its two lines');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  check(await vis() === 1 && await row() === 'error warn* info Spotify* Deezer', `and warn on top of it: one line (${await row()})`);
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="info"]');
  check(await vis() === 1, 'info with Spotify: its one info line, none of the untagged ones');
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Spotify"]');
  check(await vis() === 3, 'Spotify off again: info covers the plain, ok and Spotify info lines');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="info"]');
  check(await vis() === 5, 'and everything shows when nothing is picked');
  const md = await page.evaluate(() => L.markdown());
  check(/WARN \[Spotify\] sp two/.test(md) && /ERR {2}\[Deezer\] dz/.test(md) && /OK {3}done/.test(md), 'the Markdown carries the category after the level');
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Deezer"]');
  await page.click('#mbu-logpop .mbu-logpop-clear');
  await page.evaluate(() => { L.info('fresh'); });
  await frames(page);
  check(await row() === null && await vis() === 1, 'Clear forgets the categories and the filter');
});

// #697: the window resizes from its corner grip and goes full screen; both are remembered.
test('the window resizes from its corner, goes full screen, and remembers both', { tag: ['@unit'] }, async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.evaluate(() => { window.L = mk(); for (let i = 0; i < 80; i++) L.info('line ' + i); L.open(); });
  const box = () => page.evaluate(() => { const r = document.getElementById('mbu-logpop').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  const b0 = await box();
  const g = await page.locator('#mbu-logpop .mbu-logpop-grip').boundingBox();
  await page.mouse.move(g.x + 8, g.y + 8); await page.mouse.down();
  await page.mouse.move(g.x + 8 + 150, g.y + 8 - 200, { steps: 4 }); await page.mouse.up();
  const b1 = await box();
  check(b1.x === b0.x && b1.y === b0.y, `the top-left corner stays put (${JSON.stringify(b0)} → ${JSON.stringify(b1)})`);
  check(Math.abs(b1.w - (b0.w + 150)) <= 2 && Math.abs(b1.h - (b0.h - 200)) <= 2, `the grip sets the size (${b0.w}×${b0.h} → ${b1.w}×${b1.h})`);
  const st = await page.evaluate(() => JSON.parse(window.__store.get('k')));
  check(st.w === b1.w + 'px' && st.h === b1.h + 'px', `the size is remembered (${st.w} × ${st.h})`);

  await page.click('#mbu-logpop .mbu-logpop-full');
  const f = await box();
  check(f.x === 12 && f.y === 12 && f.w === 1200 - 24 && f.h === 800 - 24, `full screen fills the viewport less 12px (${JSON.stringify(f)})`);
  check(await page.evaluate(() => JSON.parse(window.__store.get('k')).full === true), 'and is remembered');
  await page.dblclick('#mbu-logpop .mbu-logpop-h b');
  const back = await box();
  check(JSON.stringify(back) === JSON.stringify(b1), `a double-click on the title bar restores the size it had (${JSON.stringify(back)})`);

  await page.click('#mbu-logpop .mbu-logpop-full');
  await page.click('#mbu-logpop .mbu-logpop-min');
  const m = await page.evaluate(() => ({ full: document.getElementById('mbu-logpop').classList.contains('full'), st: JSON.parse(window.__store.get('k')) }));
  check(!m.full && m.st.full === false && m.st.min === true, `minimising leaves full screen (${JSON.stringify(m)})`);
  await page.click('#mbu-logpop .mbu-logpop-min');
  await page.evaluate(() => { L.close(); L.open(); });
  const again = await box();
  check(again.w === b1.w && again.h === b1.h, `reopened, it has the size it was given (${JSON.stringify(again)})`);
});

// #697: a text filter in the title bar; it combines with the level and category filters.
test('the text filter shows only the lines with its text, and Escape empties it', { tag: ['@unit'] }, async ({ page }) => {
  const vis = () => page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.querySelector('.mbu-log-m').textContent));
  await page.evaluate(() => { window.L = mk(); L.cat('Spotify').info('Search picked album'); L.cat('Deezer').warn('No album found'); L.cat('Tidal').info('HTTP 429'); L.open(); });
  await page.fill('#mbu-logpop .mbu-log-q', 'ALBUM');
  await until(vis, v => v.length === 2);
  check((await vis()).join('|') === 'Search picked album|No album found', `case-insensitive, on the message (${(await vis()).join('|')})`);
  await page.fill('#mbu-logpop .mbu-log-q', 'tidal');
  await until(vis, v => v.length === 1);
  check((await vis()).join('|') === 'HTTP 429', 'and on the category');
  await page.fill('#mbu-logpop .mbu-log-q', 'album');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await until(vis, v => v.length === 1);
  check((await vis()).join('|') === 'No album found', 'it combines with the level filter');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await page.evaluate(() => L.cat('Qobuz').info('album arrives later'));
  await until(vis, v => v.length === 3);
  check((await vis()).includes('album arrives later'), 'a new line that matches shows; one that does not stays hidden');
  await page.evaluate(() => L.info('unrelated'));
  await frames(page);
  check(!(await vis()).includes('unrelated'), '…and one that does not stays hidden');
  await page.focus('#mbu-logpop .mbu-log-q');
  await page.keyboard.press('Escape');
  await until(vis, v => v.length === 5);
  check(await page.evaluate(() => !!document.getElementById('mbu-logpop') && document.querySelector('#mbu-logpop .mbu-log-q').value === ''), 'Escape in the filter empties it and keeps the window open');
});

// #705: a block kept as written, and the viewer mounted in a script's own panel
test('pre keeps a table as written; mount draws the viewer into a panel, with its own filters', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => {
    window.L = mk();
    L.info('  squeezed   to   one  ');
    L.pre('w   entity   status\n[w1] SOYUZ   failed');
    const host = document.createElement('div'); host.id = 'host'; host.style.height = '300px'; document.body.appendChild(host);
    const t = document.createElement('label'); t.id = 'tool'; t.textContent = 'debug';
    L.mount(host, { tools: t });
    L.cat('w1').info('one'); L.cat('w2').warn('two');
  });
  await frames(page);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#host .mbu-log-li')];
    const pre = rows.find(d => d.classList.contains('mbu-log-pre'));
    return { msgs: L.messages(), n: rows.length, ws: pre && getComputedStyle(pre.querySelector('.mbu-log-m')).whiteSpace, preH: pre && pre.querySelector('.mbu-log-m').getBoundingClientRect().height,
      text: pre && pre.querySelector('.mbu-log-m').textContent, tool: !!document.querySelector('#host .mbu-logpop-h #tool'),
      win: !!document.getElementById('mbu-logpop'), chips: [...document.querySelectorAll('#host .mbu-log-fb')].map(b => b.textContent).join(' '),
      md: L.markdown() };
  });
  check(r.msgs[0] === 'squeezed to one', `a plain line is still squeezed (${r.msgs[0]})`);
  check(r.text === 'w   entity   status\n[w1] SOYUZ   failed' && r.ws === 'pre', `a pre line keeps its breaks and spacing (${JSON.stringify(r.text)}, ${r.ws})`);
  check(r.preH >= 28, `and shows both its lines (${r.preH}px)`);
  check(r.md.includes('\nw   entity   status\n[w1] SOYUZ   failed'), 'and so does the Markdown');
  check(r.n === 4 && r.tool && !r.win, `mounted: every line, the script's tool in the toolbar, no floating window (${JSON.stringify(r)})`);
  check(r.chips === 'warn info w1 w2', `the workers are categories (${r.chips})`);
  // the floating window too: its filter must not hide the mounted viewer's lines
  await page.evaluate(() => L.open());
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="w2"]');
  const vis = sel => page.evaluate(s => [...document.querySelectorAll(s + ' .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').length, sel);
  check(await vis('#mbu-logpop') === 1 && await vis('#host') === 4, 'each viewer filters on its own');
  await page.evaluate(() => L.info('both'));
  await frames(page);
  check(await vis('#host') === 5, 'a new line reaches every viewer');
});

// #705: history — only kept sessions are stored, head and tail kept, the newest N, a list to read them back
test('history: keep, name, head-and-tail window, the newest N, resume, the session list', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => {
    window.__ls = new Map();
    window.st = { get: k => (__ls.has(k) ? __ls.get(k) : null), set: (k, v) => __ls.set(k, v), del: k => __ls.delete(k), keys: () => [...__ls.keys()] };
    window.mkH = keep => mbuLog({ name: 'Test', version: '1', key: 'k', load: k => window.__store.get(k), save: (k, v) => window.__store.set(k, v),
      history: { prefix: 'h:', keep, lines: 10, head: 3, store: st,
        parse: s => { const m = /^\[(\d\d):(\d\d):(\d\d)\] (\w+)\s+(?:\[(w\d)\] )?(.*)$/.exec(s); return m && { sev: m[4].toLowerCase(), cat: m[5], msg: m[6] }; } } });
  });
  const keys = () => page.evaluate(() => st.keys().filter(k => /^h:\d/.test(k) && !k.endsWith(':name')).sort());
  const r1 = await page.evaluate(async () => {
    window.L = mkH(2);
    L.info('nothing worth keeping');
    await new Promise(r => setTimeout(r, 150));
    return { stored: st.keys().length };
  });
  check(r1.stored === 0, 'a session never kept leaves nothing behind');
  const r2 = await page.evaluate(async () => {
    L.keep(); L.name('Run A'); L.name('ignored');
    for (let i = 0; i < 20; i++) L.cat('w1').info('line ' + i);
    await new Promise(r => setTimeout(r, 150));
    const id = L.sessionId(), raw = JSON.parse(st.get('h:' + id));
    return { id, n: raw.length, first: raw[1][3], gap: raw[3][3], last: raw.at(-1)[3], cat: raw.at(-1)[2], name: st.get('h:' + id + ':name'), cur: st.get('h:current') };
  });
  check(r2.n === 10 && r2.first === 'line 0' && /dropped/.test(r2.gap) && r2.last === 'line 19' && r2.cat === 'w1', `stored: the start, a note, the end (${JSON.stringify(r2)})`);
  check(r2.name === 'Run A' && r2.cur === r2.id, 'the first name stays, and the pointer names the session');
  // a stored session in the old string format, read back through parse
  await page.evaluate(() => st.set('h:20200101100000-1', JSON.stringify(['[10:00:00] DEBUG [w1] old line', '[10:00:01] ERROR boom'])));
  const r3 = await page.evaluate(() => {
    const a = L.sessionId(); L.session(); L.keep(); L.info('run B'); L.flush();
    return { a, b: L.sessionId(), list: L.sessions().map(s => s.id), lines: L.lines() };
  });
  check(r3.lines.length === 1 && /run B/.test(r3.lines[0]), 'a new session starts empty');
  check(r3.list.length === 1 && r3.list[0] === r3.a && (await keys()).length === 2, `only the newest 2 are kept, the oldest pruned (${JSON.stringify(r3.list)} ${JSON.stringify(await keys())})`);
  await page.evaluate(() => st.set('h:20200101100000-1', JSON.stringify(['[10:00:00] DEBUG [w1] old line', '[10:00:01] ERROR boom'])));
  const old = await page.evaluate(() => L.load('20200101100000-1'));
  check(old[0].sev === 'debug' && old[0].cat === 'w1' && old[0].msg === 'old line' && old[1].sev === 'error', `an old string line is parsed (${JSON.stringify(old)})`);
  await page.evaluate(() => L.forget('20200101100000-1'));
  // the viewer lists the past session, shows it read-only, and Clear history deletes it
  await page.evaluate(() => L.open());
  const opts = await page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-ses option')].map(o => o.textContent));
  check(opts.length === 2 && opts[0] === 'Current session' && /Run A$/.test(opts[1]), `the session list (${JSON.stringify(opts)})`);
  // #705 (majkinetor: "History doesn't load", "Openin history combo aalso has latency"): opening the
  // list rebuilt it, which cost a storage scan and lost the pick; a refresh with nothing new leaves it be
  const same = await page.evaluate(async () => {
    const sel = document.querySelector('#mbu-logpop .mbu-log-ses');
    sel.options[1].dataset.mark = '1';
    let reads = 0; const get = st.get; st.get = k => { reads++; return get(k); };
    sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); sel.dispatchEvent(new FocusEvent('focus'));
    L.refresh();
    st.get = get;
    return { kept: sel.options[1].dataset.mark === '1', reads };
  });
  check(same.kept && same.reads === 0, `opening or refreshing the list neither rebuilds it nor reads stored sessions again (${JSON.stringify(same)})`);
  await page.selectOption('#mbu-logpop .mbu-log-ses', r3.a);
  const past = await page.evaluate(() => ({ n: document.querySelectorAll('#mbu-logpop .mbu-log-li').length, clear: getComputedStyle(document.querySelector('#mbu-logpop .mbu-logpop-clear')).display }));
  check(past.n === 10 && past.clear === 'none', `a past session shows its stored lines, without Clear (${JSON.stringify(past)})`);
  await page.evaluate(() => L.info('live while looking back'));
  await frames(page);
  check(await page.evaluate(() => document.querySelectorAll('#mbu-logpop .mbu-log-li').length) === 10, 'live lines do not land in a past session');
  await page.selectOption('#mbu-logpop .mbu-log-ses', '');
  check(await page.evaluate(() => document.querySelectorAll('#mbu-logpop .mbu-log-li').length) === 2, 'back to the current session');
  await page.click('#mbu-logpop .mbu-logpop-hclear');
  check(JSON.stringify(await keys()) === JSON.stringify(['h:' + r3.b]), `Clear history leaves only the current session (${JSON.stringify(await keys())})`);
  // a navigation: a new page's log carries on the kept session
  const r4 = await page.evaluate(() => { L.flush(); const M = mkH(2); const ok = M.resume(M.last()); M.info('after'); return { ok, same: M.sessionId() === L.sessionId(), lines: M.messages() }; });
  check(r4.ok && r4.same && r4.lines.join('|') === 'run B|live while looking back|after', `resume carries the session on (${JSON.stringify(r4)})`);
});

// #705 (majkinetor): "We have debug option but we shouldn't as component should have its own UI for that",
// then "lets keep the switch on component and it should be disabled by default"
test('every viewer has a debug switch, off by default: off, debug lines are not recorded; it is remembered', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => { window.L = mk(); L.open(); });
  const box = '#mbu-logpop .mbu-log-dbg input';
  check(!(await page.isChecked(box)), 'debug is off by default');
  await page.evaluate(() => { L.debug('dropped'); L.cat('w1').debug('dropped too'); L.info('info still'); });
  await page.check(box);
  await page.evaluate(() => { L.debug('recorded'); L.cat('w1').debug('recorded too'); });
  const msgs = await page.evaluate(() => L.messages());
  check(msgs.join('|') === 'info still|recorded|recorded too', `debug lines only while it is on, the rest always (${msgs.join('|')})`);
  check(await page.evaluate(() => mk().debugOn()) === true, 'the switch is remembered for the next page');
  await page.evaluate(() => L.setDebug(false));
  check(!(await page.isChecked(box)), 'LOG.setDebug moves the switch');
});
