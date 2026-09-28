// An open dialog hides Mammoth's field pins, so they don't float over it, unless the
// dialog contains one of the pinned fields. That used to be an allowlist (artist-credit
// rows, then "Task"), so an instrument dialog (bass, guitar…, no Task field) hid a
// custom "Credited as" pin while producer/mixer dialogs showed it.
//
// A stub MusicBrainz page, no network, with MusicBrainz's relationship-dialog markup and
// a custom "Credited as" field (.attribute-credit).
import { test, check, until, idle } from '../../../dev/test/harness.mjs';

const SETTINGS = JSON.stringify({ customFields: [{ match: '.attribute-credit', label: 'Credited as' }] });
test.use({ profile: 'fresh', gm: { name: 'Mammoth', values: { 'mammoth:settings': SETTINGS } } });

test('a dialog hides the pins unless it hosts a pinned field', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><meta charset="utf-8"><body><div id="content"><h1>Recording</h1></div></body>' }));
  await page.goto('https://musicbrainz.org/recording/00000000-0000-0000-0000-000000000000/edit', { waitUntil: 'domcontentloaded' });
  await inject('mammoth');
  await idle(page);

  const open = kind => page.evaluate(kind => {
    document.querySelectorAll('.dialog.popover').forEach(d => d.remove());
    const d = document.createElement('div'); d.className = 'dialog popover';
    d.style.cssText = 'position:absolute;left:200px;top:200px;width:520px;background:#fff;border:1px solid #ccc;padding:16px;';
    const target = '<div class="attribute-container text"><label>Artist</label><input class="relationship-target lookup-performed" type="text" value="Mocky"></div>';
    const credit = '<div class="attribute-container credit"><input class="attribute-credit" type="text" placeholder="Credited as"></div>';
    d.innerHTML = kind === 'plain' ? '<input type="text" class="nothing">'
      : target + credit + (kind === 'task' ? '<div class="attribute-container text task"><input type="text" placeholder="Task"></div>'
        : '<div class="attribute-container"><label>Instrument</label><input class="relationship-target" type="text" value="bass"></div>');
    document.body.appendChild(d);
  }, kind);
  const state = () => page.evaluate(() => {
    const pin = [...document.querySelectorAll('.mmthf-pin')].find(p => /Credited as/i.test(p.title || ''));
    const cf = document.querySelector('.dialog.popover .attribute-credit');
    return {
      blocking: document.documentElement.classList.contains('mmthf-dialog'),
      pinned: !!(cf && cf.dataset.mmthf === '1'),
      pinVisible: !!pin && getComputedStyle(pin).opacity !== '0' && pin.style.display !== 'none',
    };
  });

  await open('instrument');
  const bass = await until(state, s => s.pinned && s.pinVisible && !s.blocking);
  check(bass.pinned && bass.pinVisible && !bass.blocking, `an instrument dialog (no Task) shows its "Credited as" pin (${JSON.stringify(bass)})`);

  await open('task');
  const mixer = await until(state, s => s.pinned && s.pinVisible && !s.blocking);
  check(mixer.pinned && mixer.pinVisible && !mixer.blocking, `a dialog with Task shows it too (${JSON.stringify(mixer)})`);

  await open('plain');
  check((await until(state, s => s.blocking)).blocking, 'a dialog with no pinned field hides the pins');
});
