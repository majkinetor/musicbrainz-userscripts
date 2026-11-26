// adb helpers for the emulator: run a shell command, find a control by its text and tap it, take a screenshot,
// and read what Android's media session and audio service say about Firefox.
// As a command: node dev/android/adb.mjs <helper> [args], for example `tap Continue`, `shot s.png`, `media`, `ui`.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdk = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
export const FF = 'org.mozilla.firefox';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20 });
export const sh = cmd => adb('shell', cmd);
export const key = k => sh(`input keyevent ${k}`);
export const open = url => sh(`am start -a android.intent.action.VIEW -d '${url}' ${FF}`);

// the controls on screen, each with its text, description, resource id and center point
export function ui() {
  sh('uiautomator dump /sdcard/ui.xml');
  const xml = adb('exec-out', 'cat', '/sdcard/ui.xml');
  const nodes = [];
  for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
    const at = {}; for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) at[a[1]] = a[2];
    const b = (at.bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/); if (!b) continue;
    nodes.push({ text: at.text, desc: at['content-desc'], id: at['resource-id'], cls: at.class, x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1 });
  }
  return nodes;
}
// the first control whose text, description or id matches; a string matches whole, a RegExp anywhere
export function find(what, nodes = ui()) {
  const ok = s => s && (what instanceof RegExp ? what.test(s) : s === what);
  return nodes.find(n => ok(n.text) || ok(n.desc) || ok(n.id));
}
export async function tap(what, { wait = 10000 } = {}) {
  const end = Date.now() + wait;
  for (;;) {
    const n = find(what);
    if (n) { sh(`input tap ${n.x} ${n.y}`); return n; }
    if (Date.now() > end) throw new Error(`no control ${what}`);
    await sleep(700);
  }
}
// installs or updates a userscript in Violentmonkey: opens its address and taps the install button
export async function install(url, again = true) {
  sh(`am force-stop ${FF}`);   // a fresh Firefox: a prompt left by a test page (DRM, a tip) would cover the install page
  open(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());   // a new address each time, or Firefox shows its cached copy
  try { await tap(/^(Install|Reinstall|Update)$/, { wait: 30000 }); }
  catch (e) {
    // after some test runs, Violentmonkey stops opening its install page until Android restarts
    if (!again) throw e;
    console.error('no install page: restarting the emulator');
    await reboot();
    return install(url, false);
  }
  await tap(/^Script installed/, { wait: 10000 }).catch(() => {});
  return 'installed ' + url;
}
// the ports linked to the computer with adb reverse, for example ['tcp:8777']
export const ports = () => adb('reverse', '--list').split('\n').map(l => (l.match(/\s(tcp:\d+)\s/) || [])[1]).filter(Boolean);
// restarts Android, waits until it booted, and links again every port that was linked before (8777 at least)
export async function reboot() {
  const linked = [...new Set(['tcp:8777', ...ports()])];
  adb('reboot'); await sleep(10000); adb('wait-for-device');   // the old boot's state answers until Android goes down
  const up = () => { try { return sh('getprop sys.boot_completed').trim() === '1' && !/not found/.test(sh('service check activity')); } catch (e) { return false; } };
  for (let i = 0; i < 100 && !up(); i++) await sleep(3000);
  for (const p of linked) adb('reverse', p, p);
  await sleep(8000);   // Firefox's add-ons start after the boot
}
// one user at a time: a session takes the lock before it uses the emulator and frees it after. The lock is a file on
// the device, so every checkout and every agent sees the same one. A lock older than two hours counts as left behind
const LOCK = '/data/local/tmp/emu-lock';
const held = () => { const m = sh('cat ' + LOCK + ' 2>/dev/null; true').trim().match(/^(\d+) (.*)$/); return m ? { at: +m[1], who: m[2] } : null; };
export function lock(who) {
  who = (who || '').replace(/[^\w #.,:/()-]/g, '').trim();
  if (!who) throw new Error('lock needs a name: who you are and what you test');
  const old = held();
  if (old && old.who !== who && Date.now() - old.at < 2 * 3600e3) throw new Error('the emulator is in use: ' + old.who + ', since ' + new Date(old.at).toLocaleTimeString());
  sh("echo '" + Date.now() + ' ' + who + "' > " + LOCK);
  return 'locked for ' + who;
}
export const unlock = () => { sh('rm -f ' + LOCK); return 'unlocked'; };
export const who = () => { const h = held(); return h ? h.who + ', since ' + new Date(h.at).toLocaleTimeString() : 'free'; };
export const tapAt = (x, y) => sh(`input tap ${x} ${y}`);
export const shot = file => writeFileSync(file, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));

// Firefox's media session as Android sees it: is it active, its state, its actions and the track's title
export function media() {
  const out = sh('dumpsys media_session');
  const blocks = out.split(/\n(?=\s{4}\S.*package=)/).filter(b => b.includes(`package=${FF}`));
  return blocks.map(b => ({
    active: /active=true/.test(b),
    state: (b.match(/state=PlaybackState \{state=(\w+)/) || [])[1],
    position: +((b.match(/position=(\d+)/) || [])[1] || 0),
    actions: (b.match(/actions=(\d+)/) || [])[1],
    title: (b.match(/description=([^\n]*)/) || [])[1],
  }));
}
// the audio players Android counts as playing, for Firefox's process
export function audio() {
  const uid = (sh(`dumpsys package ${FF}`).match(/(?:appId|userId)=(\d+)/) || [])[1];
  const out = sh('dumpsys audio');
  const players = [...out.matchAll(/AudioPlaybackConfiguration piid:(\d+).*?u\/pid:(\d+)\/\d+.*?state:(\w+)/g)];
  return players.filter(p => p[2] === uid).map(p => ({ piid: +p[1], state: p[3] }));
}
export const playing = () => audio().some(p => p.state === 'started');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2);
  const out = { ui: () => ui().filter(n => n.text || n.desc), tap: () => tap(/^\/.*\/$/.test(a[0]) ? new RegExp(a[0].slice(1, -1)) : a.join(' ')), shot: () => shot(a[0] || 'shot.png'), media, audio, install: () => install(a[0]), reboot: () => reboot(), ports, lock: () => lock(a.join(' ')), unlock, who, key: () => key(a[0]), open: () => open(a[0]), sh: () => sh(a.join(' ')) }[cmd];
  if (!out) { console.log('helpers: ui, tap <text|/regex/>, shot <file>, media, audio, install <url>, reboot, ports, lock <who>, unlock, who, key <code>, open <url>, sh <cmd>'); process.exit(1); }
  const r = await out(); if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
}
