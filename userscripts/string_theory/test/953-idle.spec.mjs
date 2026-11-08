import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test, expect } from '@playwright/test';

const source = readFileSync(process.env.ST_THEME_SRC || new URL('../themes/runtime.js', import.meta.url), 'utf8');
function runtime(idle, extra = {}) {
  let now = 0, next = 0;
  const timers = new Map(), listeners = new Map(), attrs = new Map();
  const saved = { mode: 'light', light: 'Default', dark: 'Default', idle, ...extra };
  const style = { setAttribute(k, v) { this[k] = v; }, isConnected: true };
  const root = { classList: { toggle() {} }, appendChild() {}, setAttribute(k, v) { attrs.set(k, v); }, removeAttribute(k) { attrs.delete(k); }, toggleAttribute(k, v) { if (v) attrs.set(k, ''); else attrs.delete(k); } };
  const on = (name, fn) => listeners.set(name, fn);
  const context = vm.createContext({
    location: { hostname: 'test.musicbrainz.org' },
    document: { documentElement: root, readyState: 'complete', createElement: () => style, addEventListener: on },
    localStorage: { getItem: () => JSON.stringify(['Night']) }, sessionStorage: { getItem: () => null },
    GM_getValue: () => structuredClone(saved), GM_setValue: (k, v) => Object.assign(saved, v),
    setTimeout: (fn, ms) => { timers.set(++next, { at: now + ms, fn }); return next; },
    clearTimeout: id => timers.delete(id), setInterval() {},
  });
  context.window = context; context.top = context; context.addEventListener = on;
  vm.runInContext(source.replace('__ST_THEMES__', JSON.stringify({ light: { Default: 'light', Other: 'other' }, dark: { Default: 'dark' } })), context);
  return { saved, attrs, style, api: context.__stTheme,
    event: name => listeners.get(name)?.(),
    advance(ms) { now += ms; for (const [id, t] of timers) if (t.at <= now) { timers.delete(id); t.fn(); } },
  };
}

test('idle timeout resets on activity, restores appearance, never saves the idle theme @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'dark:Default', effect: 'Night' });
  r.advance(59000); expect(r.style['data-variant']).toBe('light');
  r.event('pointermove'); r.advance(59000); expect(r.style['data-variant']).toBe('light');
  r.advance(1000); expect(r.style['data-variant']).toBe('dark'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('Night');
  expect(r.saved.mode).toBe('light');
  r.event('keydown'); expect(r.style['data-variant']).toBe('light'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
  r.advance(60000); expect(r.style['data-variant']).toBe('dark');
  r.api.set({ idle: { on: false } }); r.advance(60000); expect(r.style['data-variant']).toBe('light');
});

test('idle theme and effect are independent, normal effect mapping stays untouched @unit', () => {
  const r = runtime({ on: true, minutes: 1, theme: 'dark:Default' }, { eh: { 'light:Default': 'Night', 'dark:Default': '-' } });
  r.advance(60000); expect(r.style['data-variant']).toBe('dark');
  expect(r.attrs.get('data-st-eh-fx')).toBe('Night'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
  r.api.set({ idle: { on: true, minutes: 1, effect: '-' } }); r.advance(60000);
  expect(r.style['data-variant']).toBe('light'); expect(r.attrs.get('data-st-eh-fx-idle')).toBe('-');
  r.event('touchstart'); expect(r.attrs.has('data-st-eh-fx-idle')).toBe(false);
});

test('idle is off by default and preview has priority @unit', () => {
  const r = runtime(undefined); r.advance(86400000); expect(r.attrs.has('data-st-idle')).toBe(false);
  r.api.set({ idle: { on: true, minutes: 1, theme: 'dark:Default' } });
  r.api.preview({ mode: 'light', light: 'Other' }); r.advance(60000);
  expect(r.style.textContent).toBe('other');
  r.api.preview(); expect(r.style['data-variant']).toBe('dark');
  r.event('focus'); expect(r.style['data-variant']).toBe('light');
});
