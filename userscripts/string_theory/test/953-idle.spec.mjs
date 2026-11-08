import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test, expect } from '@playwright/test';

const source = readFileSync(process.env.ST_THEME_SRC || new URL('../themes/runtime.js', import.meta.url), 'utf8');
function runtime(idle, extra = {}, effects = ['Night']) {
  let now = 0, next = 0;
  const timers = new Map(), listeners = new Map(), attrs = new Map();
  const saved = { mode: 'light', light: 'Default', dark: 'Default', idle, ...extra };
  const style = { setAttribute(k, v) { this[k] = v; }, isConnected: true };
  const fade = { isConnected: false, textContent: '' };
  let styles = 0;
  const pill = { setAttribute(k, v) { this[k] = v; }, remove() { this.isConnected = false; }, isConnected: false, innerHTML: '' };
  const root = { classList: { toggle() {} }, appendChild(n) { n.isConnected = true; }, setAttribute(k, v) { attrs.set(k, v); }, removeAttribute(k) { attrs.delete(k); }, toggleAttribute(k, v) { if (v) attrs.set(k, ''); else attrs.delete(k); } };
  const on = (name, fn) => listeners.set(name, fn);
  const context = vm.createContext({
    location: { hostname: 'test.musicbrainz.org' },
    document: { documentElement: root, readyState: 'complete', createElement: tag => tag === 'div' ? pill : styles++ ? fade : style, addEventListener: on },
    localStorage: { getItem: () => JSON.stringify(effects) }, sessionStorage: { getItem: () => null },
    GM_getValue: () => structuredClone(saved), GM_setValue: (k, v) => Object.assign(saved, v),
    setTimeout: (fn, ms) => { timers.set(++next, { at: now + ms, fn }); return next; },
    clearTimeout: id => timers.delete(id), setInterval() {},
  });
  context.window = context; context.top = context; context.addEventListener = on;
  vm.runInContext(source.replace('__ST_THEMES__', JSON.stringify({ light: { Default: 'light', Other: 'other' }, dark: { Default: 'dark', Other: 'other-dark' } })), context);
  return { saved, attrs, style, pill, api: context.__stTheme, doc: context.document, fadeCss: () => fade.textContent,
    random(value) { context.Math = Object.create(Math); context.Math.random = () => value; },
    event: name => listeners.get(name)?.(),
    advance(ms) { now += ms; for (const [id, t] of timers) if (t.at <= now) { timers.delete(id); t.fn(); } },
  };
}

test('idle timeout resets on activity, restores appearance, never saves the idle theme @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'Other', effect: 'Night' });
  r.advance(59000); expect(r.style['data-variant']).toBe('light');
  r.event('pointermove'); r.advance(59000); expect(r.style['data-variant']).toBe('light');
  r.advance(1000); expect(r.style.textContent).toBe('other'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  expect(r.saved.mode).toBe('light');
  r.event('keydown'); expect(r.style['data-variant']).toBe('light'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
  r.advance(60000); expect(r.style.textContent).toBe('other');
  r.api.set({ idle: { on: false } }); r.advance(60000); expect(r.style['data-variant']).toBe('light');
});

test('idle theme and effect are independent, normal effect mapping stays untouched @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'Other', effect: '' }, { eh: { 'light:Default': 'Night', 'dark:Default': '-' } });
  r.advance(60000); expect(r.style.textContent).toBe('other');
  expect(r.attrs.get('data-st-eh-fx')).toBe('Night'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
  r.api.set({ idle: { on: true, minutes: 1, effect: '-' } }); r.advance(60000);
  expect(r.style['data-variant']).toBe('light'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('-');
  r.event('touchstart'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
});

test('idle is on by default with a random theme and effect, preview has priority @unit', () => {
  const r = runtime(undefined);
  expect(r.api.read().idle).toEqual({ on: true, minutes: 5, theme: '*', effect: '*', info: true, cont: true });
  r.advance(299000); expect(r.attrs.has('data-st-idle')).toBe(false);
  r.advance(1000); expect(r.attrs.has('data-st-idle')).toBe(true); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  r.event('keydown'); expect(r.attrs.has('data-st-idle')).toBe(false);
  const off = runtime({ on: false, theme: '', effect: '' }); off.advance(86400000); expect(off.attrs.has('data-st-idle')).toBe(false);
  expect(off.api.read().idle).toEqual({ on: false, minutes: 5, theme: '', effect: '', info: true, cont: true });
  r.api.set({ idle: { on: true, minutes: 1, theme: 'Other' } });
  r.api.preview({ mode: 'dark' }); r.advance(60000);
  expect(r.style['data-variant']).toBe('dark');
  r.api.preview(); expect(r.style.textContent.startsWith('other')).toBe(true);
  r.event('focus'); expect(r.style['data-variant']).toBe('light');
});

test('random idle choices are picked once per idle period and never persisted @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: '*', effect: '*' }, {}, ['Day', 'Night']);
  r.random(0.99); r.advance(60000);
  expect(r.style['data-variant']).toBe('light'); expect(r.style.textContent).toBe('other');
  expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  expect(r.saved.idle.theme).toBe('*'); expect(r.saved.idle.effect).toBe('*');
  r.random(0); r.api.preview({ mode: 'light', light: 'Other' }); r.api.preview();
  expect(r.style.textContent).toBe('other'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  r.event('pointerdown'); expect(r.style['data-variant']).toBe('light');
  r.advance(60000); expect(r.style.textContent.startsWith('light')).toBe(true);
  expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Day');
});

for (const theme of ['Other', '*', 'light:Other']) test('idle theme ' + theme + ' always follows the current variant @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme }, { mode: 'dark' });
  r.random(0.99); r.advance(60000);
  expect(r.style['data-variant']).toBe('dark'); expect(r.style.textContent.startsWith('other-dark')).toBe(true);
  expect(r.api.read().idle.theme).toBe(theme === '*' ? '*' : 'Other');
  r.saved.mode = 'light'; r.api.preview();
  expect(r.style['data-variant']).toBe('light'); expect(r.style.textContent.startsWith('other\n')).toBe(true);
});

test('continuous re-picks the random parts after each further idle period, never the same @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: '*', effect: '*', cont: true }, {}, ['Day', 'Night']);
  r.random(0); r.advance(60000);
  expect(r.style.textContent).toBe('light'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Day');
  r.advance(60000); expect(r.style.textContent).toBe('other'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  r.advance(60000); expect(r.style.textContent).toBe('light'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Day');
  r.event('keydown'); expect(r.attrs.has('data-st-idle')).toBe(false);
  r.advance(59000); expect(r.attrs.has('data-st-idle')).toBe(false);
  // only the Random part changes; without continuous the pick holds
  r.api.set({ idle: { on: true, minutes: 1, theme: 'Other', effect: '*', cont: true } });
  r.advance(60000); r.advance(60000); expect(r.style.textContent).toBe('other'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  r.api.set({ idle: { on: true, minutes: 1, theme: '*', effect: '*', cont: false } });
  r.advance(60000); const fx = r.attrs.get('data-st-eh-fx-idle'); r.advance(300000); expect(r.attrs.get('data-st-eh-fx-idle')).toBe(fx);
});

test('theme info names the idle theme and effect, only while idle and not previewing @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'Other', effect: '-', info: true });
  r.advance(59000); expect(r.pill.isConnected).toBe(false);
  r.advance(1000); expect(r.pill.isConnected).toBe(true);
  expect(r.pill.innerHTML).toContain('<span>Other</span>'); expect(r.pill.innerHTML).toContain('<span>None</span>');
  expect(r.pill.style).toContain('pointer-events:none');
  r.api.preview({ mode: 'dark' }); expect(r.pill.isConnected).toBe(false);
  r.api.preview(); expect(r.pill.isConnected).toBe(true);
  r.event('pointermove'); expect(r.pill.isConnected).toBe(false);
  r.api.set({ idle: { on: true, minutes: 1, theme: 'Other', effect: 'Night', info: false } }); r.advance(60000);
  expect(r.attrs.has('data-st-idle')).toBe(true); expect(r.pill.isConnected).toBe(false);
});

test('idle changes cross-fade through a view transition: slow in, quick out @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'Other', effect: '' });
  const fades = [];
  r.doc.startViewTransition = fn => { fades.push(r.fadeCss()); fn(); };
  r.advance(60000); expect(r.style.textContent).toBe('other'); expect(fades[0]).toContain('animation-duration:1500ms');
  r.event('keydown'); expect(r.style.textContent).toBe('light'); expect(fades[1]).toContain('animation-duration:300ms');
  r.event('keydown'); expect(fades.length).toBe(2);
});
