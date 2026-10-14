// #748: a submit that fails on a busy server (503) or a dropped connection is repeated by itself, as Art Station repeats
// a failed upload: up to the settings' minutes or attempts, each wait told to the listener (Mission Control's apply). A
// refused submit (400) is not repeated, nor is anything when the setting is off. withRepeat itself, in Node, with its
// waits skipped.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const load = async values => {
  const src = await functionSource('isrc_scout', ['repeatOn', 'repeatNum', 'repeatMinutes', 'repeatTimes', 'isTransient', 'withRepeat']);
  const store = { get: (k, d) => (k in values ? values[k] : d) };
  const logs = [], Log = { warn: m => logs.push(m) }, toast = () => {};
  // the waits, skipped: a fake clock that each one moves on
  let now = 1e12;
  const FakeDate = { now: () => now };
  const instant = (f, ms) => { now += ms || 0; f(); };
  const env = new Function('store', 'Log', 'toast', 'setTimeout', 'Date', src.replace('let repeatWatch = null;', '') + '; let repeatWatch = null; return { withRepeat, watch: f => { repeatWatch = f; } };')(store, Log, toast, instant, FakeDate);
  return { env, logs };
};
const failing = (errs, value) => { let i = 0; return async () => { if (i < errs.length) throw new Error(errs[i++]); return value; }; };

test('#748: a busy server is tried again, a refused submit is not', { tag: ['@unit'] }, async () => {
  let { env, logs } = await load({});
  const heard = []; env.watch(n => heard.push(n));
  const v = await env.withRepeat(failing(['submit failed (503): busy', 'HTTP 503'], 'ok'), 'The ISRC submit');
  check(v === 'ok' && logs.length === 2 && heard.length >= 2 && /repeating in \d+ s \(attempt 1 of 10\)/.test(heard[0]), `two 503s, then it goes through; each wait is told (${JSON.stringify(heard.slice(0, 2))})`);

  let e = await env.withRepeat(failing(['submit failed (400): bad ISRC']), 'The ISRC submit').catch(x => x);
  check(e instanceof Error && e.transient === false && e.repeated === 0, 'a 400 is thrown at once, not repeated');

  ({ env } = await load({ auto_repeat_times: 3 }));
  e = await env.withRepeat(failing(Array(9).fill('submit failed (503)')), 'The ISRC submit').catch(x => x);
  check(e instanceof Error && e.transient === true && e.repeated === 3, `it gives up after the attempts set (${e && e.repeated})`);

  ({ env } = await load({ auto_repeat: false }));
  e = await env.withRepeat(failing(['submit failed (503)']), 'The ISRC submit').catch(x => x);
  check(e instanceof Error && e.repeated === 0 && e.transient === true, 'off: not repeated, and still said to be worth a retry');
});
