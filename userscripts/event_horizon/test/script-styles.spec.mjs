import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// While Event Horizon shows, only MusicBrainz's own sheets go off. A script's <style> without an id stayed off
// too when that script started first: Mammoth's panel in Art Station's commit dialog came up unstyled
test('a script\'s style without an id stays on while Event Horizon shows', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=tracks:%5B5%20TO%2020%5D&limit=1&fmt=json')).json()).releases[0].id);
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await page.evaluate(() => { const s = document.createElement('style'); s.className = 'spec-script-style'; s.textContent = '.spec-x{color:red}'; document.head.append(s); });
  await inject('event_horizon');
  check(await until(() => page.locator('.tr[data-row]').count(), n => n >= 2) >= 2, 'Event Horizon shows the release');
  const st = await page.evaluate(() => ({
    script: document.querySelector('style.spec-script-style').disabled,
    mb: [...document.querySelectorAll('link[rel~="stylesheet"]')].filter(l => /static\.metabrainz\.org/.test(l.href)).map(l => l.disabled),
  }));
  check(st.script === false, 'the script\'s style is still on');
  check(st.mb.length > 0 && st.mb.every(Boolean), 'MusicBrainz\'s own sheets are off: ' + JSON.stringify(st.mb));
});
