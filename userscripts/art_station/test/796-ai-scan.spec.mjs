// #796 AI scan: ✦ on a cover copies the image to the clipboard and opens an AI chat
// with a prompt that asks for Group Therapy's Text parser lines, the release's tracklist
// included. The clipboard and window.open are stubbed in the page, so nothing leaves it.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation, RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station', values: {} } });

test('✦ copies the cover and opens the chosen AI with the prompt', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const wsReads = [];
  page.on('request', r => { if (/\/ws\/2\/release\/.*inc=recordings/.test(r.url())) wsReads.push(r.url()); });
  await openArtStation(page, inject);
  await page.evaluate(() => {
    window.__clip = []; window.__opened = [];
    navigator.clipboard.write = async items => { for (const it of items) for (const t of it.types) window.__clip.push({ type: t, size: (await it.getType(t)).size }); };
    navigator.clipboard.writeText = async t => { window.__clip.push({ type: 'text', text: t }); };
    window.open = (u) => { window.__opened.push(u); return null; };
  });

  const card = page.locator('.as-card:not(.new)').first();
  await card.hover();
  check(await card.locator('.as-fai').count() === 1, 'a published cover has the ✦');
  await card.locator('.as-fai').click();
  const names = await page.$$eval('.as-ai-pop .as-search-eng', bs => bs.map(b => b.textContent));
  check(names.join(',') === 'ChatGPT,Claude,Gemini,Perplexity,Grok,Copilot', 'the menu lists the AIs — ' + names);
  await page.click('.as-ai-pop .as-search-eng:has-text("ChatGPT")');
  const opened = await until(() => page.evaluate(() => window.__opened.slice()), o => o.length === 1);
  const url = opened[0] || '';
  check(url.startsWith('https://chatgpt.com/?q='), 'ChatGPT opens — ' + url.slice(0, 40));
  const q = decodeURIComponent(url.split('?q=')[1] || '');
  console.log(q);
  check(q.includes(`/release/${RELEASE}`), 'the prompt links the release');
  check(/\{\{E - R\}\}/.test(q) && /R: E/.test(q), 'the prompt explains the patterns and {{…}}');
  check(/Tracks \(position\. title\):\n1\. /.test(q), 'the prompt carries the tracklist');
  const clip = await page.evaluate(() => window.__clip);
  check(clip.length === 1 && clip[0].type === 'image/png' && clip[0].size > 1000, 'the image is on the clipboard as PNG — ' + JSON.stringify(clip));

  // right-click goes straight to the last AI, and the tracklist isn't read again
  await card.hover();
  await card.locator('.as-fai').click({ button: 'right' });
  const again = await until(() => page.evaluate(() => window.__opened.slice()), o => o.length === 2);
  check((again[1] || '').startsWith('https://chatgpt.com/'), 'right-click opens the last AI used');
  check(wsReads.length === 1, 'one tracklist read per page — ' + wsReads.length);

  // Gemini takes no prompt in its URL: the prompt rides the clipboard with the image
  await card.hover();
  await card.locator('.as-fai').click();
  check(await page.locator('.as-ai-pop .as-search-eng').first().textContent() === 'ChatGPT', 'the last AI is listed first');
  await page.click('.as-ai-pop .as-search-eng:has-text("Gemini")');
  const g = await until(() => page.evaluate(() => window.__clip.slice(2)), c => c.length >= 2);
  check(g.map(c => c.type).sort().join() === 'image/png,text/plain', 'Gemini gets the image and the prompt — ' + JSON.stringify(g));
});

test('the real clipboard takes the PNG', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://test.musicbrainz.org' });
  await openArtStation(page, inject);
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  const card = page.locator('.as-card:not(.new)').first();
  await card.hover();
  await card.locator('.as-fai').click();
  await page.click('.as-ai-pop .as-search-eng:has-text("Claude")');
  const opened = await until(() => page.evaluate(() => window.__opened.slice()), o => o.length === 1);
  check((opened[0] || '').startsWith('https://claude.ai/new?q='), 'Claude opens — ' + (opened[0] || '').slice(0, 40));
  const types = await page.evaluate(async () => { try { const it = await navigator.clipboard.read(); return it.flatMap(i => i.types); } catch (e) { return 'ERR ' + e.message; } });
  check(Array.isArray(types) && types.includes('image/png'), 'the clipboard holds the PNG — ' + JSON.stringify(types));
});
