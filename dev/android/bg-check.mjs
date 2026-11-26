// Plays a page in the emulator's Firefox, sends Firefox to the background, and reports every few seconds what plays.
// node dev/android/bg-check.mjs <url> [--play <text|/regex/>] [--fg 15] [--bg 60] [--every 5] [--off] [--keys]
//   --play   the control to tap to start playback (default: Play); --play none taps nothing
//   --off    also turns the screen off in the background, as a locked phone
//   --keys   in the background, sends the headphone keys: pause, play, next, previous
// The page's own report (control/index.html) comes from server.mjs when it runs; Android's view comes from dumpsys.
import { open, tap, key, media, sh, FF, playing } from './adb.mjs';

const args = process.argv.slice(2), url = args[0] && !args[0].startsWith('--') ? args[0] : '';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const has = k => args.includes('--' + k);
const fg = +opt('fg', 15), bg = +opt('bg', 60), every = +opt('every', 5), play = opt('play', 'Play');
if (!url) { console.log('usage: node bg-check.mjs <url> [--play <text|/regex/>] [--fg 15] [--bg 60] [--every 5] [--off] [--keys]'); process.exit(1); }
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const t0 = Date.now(), at = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's';

async function page() { try { const r = await fetch('http://localhost:8777/state'); const j = await r.json(); return j && Date.now() - j.at < 30000 ? j : null; } catch (e) { return null; } }
async function line(tag) {
  const m = media()[0] || {}, p = await page();
  const own = p ? ` | page ${p.kind}#${p.i} ${p.state} ${(+p.pos || 0).toFixed(0)}s ended=${p.ended} ${p.vis}` : '';
  const row = `${at()} ${tag.padEnd(4)} audio ${playing() ? 'on ' : 'off'} android ${m.state || '-'} ${((m.position || 0) / 1000).toFixed(0)}s "${(m.title || '').trim().slice(0, 40)}"${own}`;
  console.log(row);
  return { m, p };
}

sh('svc power stayon true'); key('KEYCODE_WAKEUP');
// a fresh Firefox: an earlier run's tab must not play beside this one. Restored tabs load only when shown.
sh(`am force-stop ${FF}`);
open(url);
await sleep(8);
if (play !== 'none') await tap(/^\/.*\/$/.test(play) ? new RegExp(play.slice(1, -1)) : play, { wait: 30000 });
for (let s = 0; s < fg; s += every) { await sleep(every); await line('fg'); }
key('KEYCODE_HOME');
if (has('off')) { sh('svc power stayon false'); key('KEYCODE_SLEEP'); }
const keys = has('keys') ? { 15: 'KEYCODE_MEDIA_PAUSE', 25: 'KEYCODE_MEDIA_PLAY', 35: 'KEYCODE_MEDIA_NEXT', 50: 'KEYCODE_MEDIA_PREVIOUS' } : {};
const rows = [];
for (let s = every; s <= bg; s += every) {
  await sleep(every);
  for (const k of Object.keys(keys)) if (+k > s - every && +k <= s) { key(keys[k]); console.log(`${at()} key  ${keys[k]}`); }
  rows.push(await line(has('off') ? 'off' : 'bg'));
}
if (has('off')) { key('KEYCODE_WAKEUP'); sh('svc power stayon true'); }
const last = rows.at(-1) || {}, playingAll = rows.every(r => r.m.state === 'PLAYING');
console.log(`result: ${playingAll ? 'PLAYED' : 'STOPPED'} in the background; last Android state ${last.m?.state || '-'}`);
