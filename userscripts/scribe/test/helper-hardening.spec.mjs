// Scribe helper hardening (#623, SEC-1). A request's "ext" chose the temp file's
// extension, and with no editor configured the OS opened (ran) it; the session "id"
// went into the file name unchecked, so "..\" wrote outside the temp folder. Now the
// file is always .md and an id may only be letters, digits and dashes.
//
// No browser: a headless helper (the net9.0 build) runs on a spare port with
// `--editor none`, so nothing is ever opened. `--editor` is saved to
// %LOCALAPPDATA%\Scribe\settings.json, so that file is backed up and restored.
// Build it first: `dotnet build -c Release -f net9.0` in userscripts/scribe/helper.
// HELPER_EXE=<an older headless build> to watch it fail.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { test, check, REPO } from '../../../dev/test/harness.mjs';

const EXE = process.env.HELPER_EXE || resolve(REPO, 'userscripts/scribe/helper/bin/Release/net9.0/scribe.exe');
const PORT = 17998, TOKEN = 'extedit', BASE = `http://127.0.0.1:${PORT}`;
const SETTINGS = join(process.env.LOCALAPPDATA || '', 'Scribe', 'settings.json');
const PROBE = join(tmpdir(), 'scribe-traversal-probe.md');   // where "..\" would land: %TEMP%, above %TEMP%\extedit
const sleep = ms => new Promise(r => setTimeout(r, ms));
const req = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'X-ExtEdit-Token': TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch (e) { /* not JSON */ }
  return { status: r.status, json };
};

test('the helper writes only .md files, and only inside its temp folder', { tag: ['@unit', '@critical'] }, async () => {
  test.skip(process.platform !== 'win32' || !existsSync(EXE), 'the helper build is missing: ' + EXE);
  const settingsBackup = existsSync(SETTINGS) ? readFileSync(SETTINGS) : null;
  try { unlinkSync(PROBE); } catch (e) { /* not there */ }
  const proc = spawn(EXE, ['--port', String(PORT), '--editor', 'none'], { stdio: 'ignore', windowsHide: true });
  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { await sleep(250); try { up = (await fetch(BASE + '/ping')).status === 200; } catch (e) { /* not yet */ } }
    if (!up) throw new Error('the helper did not come up on ' + BASE);

    // the extension a request asks for is ignored
    const a = await req('POST', '/open', { id: 'rel-abcd1234-kx9q', content: 'hello', ext: 'bat', name: 'release' });
    check(a.status === 200 && /\.md$/i.test((a.json && a.json.file) || ''), `ext:"bat" gives a .md file (${a.json && a.json.file})`);
    check(a.json && existsSync(a.json.file) && readFileSync(a.json.file, 'utf8') === 'hello', '…holding the content');

    // the userscript's own id shapes still work
    const b = await req('POST', '/open', { id: 'lq3k2x9ab12cd', content: 'note', ext: 'md', name: 'Edit note' });
    check(b.status === 200 && /\.md$/.test((b.json && b.json.file) || ''), 'a field-editor id (base36) opens');

    // a path in the id is refused. The file is named "extedit-<id>.md", so a LEADING ".."
    // only makes a folder called "extedit-.."; after "x\" the two ".." climb out of %TEMP%\extedit.
    for (const bad of ['x\\..\\..\\scribe-traversal-probe', 'x/../../scribe-traversal-probe', '..\\scribe-traversal-probe', 'a/b', '']) {
      const r = await req('POST', '/open', { id: bad, content: 'x', ext: 'md', name: '' });
      check(r.status === 400, `id ${JSON.stringify(bad)} is refused (${r.status})`);
    }
    check(!existsSync(PROBE), 'nothing was written outside the temp folder: ' + PROBE);

    // edit → save → /result → /close still works
    // /result answers a change against the time the file was opened, so the order of
    // the request and the write does not matter
    const pending = req('GET', '/result?id=rel-abcd1234-kx9q');
    writeFileSync(a.json.file, 'hello, edited');
    const res = await pending;
    check(res.status === 200 && res.json && res.json.content === 'hello, edited', `a save comes back through /result ("${res.json && res.json.content}")`);
    await req('GET', '/close?id=rel-abcd1234-kx9q'); await req('GET', '/close?id=lq3k2x9ab12cd');
    check(!existsSync(a.json.file), '/close removes the temp file');
  } finally {
    proc.kill();
    if (settingsBackup) writeFileSync(SETTINGS, settingsBackup);   // --editor none was saved; put the user's editor back
    try { unlinkSync(PROBE); } catch (e) { /* not there, as it should be */ }
  }
});
