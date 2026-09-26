// Scribe helper hardening (sweep SEC-1): a request's "ext" chose the temp file's extension, and
// with no editor configured the OS opened (i.e. RAN) it; the session "id" went into the file
// name unchecked, so "..\" wrote the file outside the temp folder. Now the file is always .md and
// an id may only be letters, digits and dashes.
//
// Runs a HEADLESS helper (net9.0 build) on a spare port with `--editor none`, so nothing is ever
// opened. `--editor` is persisted to %LOCALAPPDATA%\Scribe\settings.json, so that file is backed
// up first and restored in `finally`. HELPER_EXE=<an older headless build> to watch it fail.
//   dotnet build -c Release -f net9.0   (in userscripts/scribe/helper) before running
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXE = process.env.HELPER_EXE || resolve(HERE, '..', 'helper', 'bin', 'Release', 'net9.0', 'scribe.exe');
const PORT = 17998, TOKEN = 'extedit', BASE = `http://127.0.0.1:${PORT}`;
const SETTINGS = join(process.env.LOCALAPPDATA || '', 'Scribe', 'settings.json');
const PROBE = join(tmpdir(), 'scribe-traversal-probe.md');   // where "..\" would land: %TEMP%, one level above %TEMP%\extedit
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const req = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'X-ExtEdit-Token': TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
};

if (!existsSync(EXE)) { console.log('helper build not found: ' + EXE); process.exit(2); }
const settingsBackup = existsSync(SETTINGS) ? readFileSync(SETTINGS) : null;
try { unlinkSync(PROBE); } catch (e) {}
const proc = spawn(EXE, ['--port', String(PORT), '--editor', 'none'], { stdio: 'ignore', windowsHide: true });
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await sleep(250); try { up = (await fetch(BASE + '/ping')).status === 200; } catch (e) {} }
  if (!up) { console.log('helper did not come up on ' + BASE); process.exitCode = 2; }
  else {
    // 1) the extension a request asks for is ignored: always .md
    const a = await req('POST', '/open', { id: 'rel-abcd1234-kx9q', content: 'hello', ext: 'bat', name: 'release' });
    ck(a.status === 200 && /\.md$/i.test(a.json && a.json.file || ''), `ext:"bat" → the file is .md (${a.json && a.json.file})`);
    ck(a.json && existsSync(a.json.file) && readFileSync(a.json.file, 'utf8') === 'hello', '…and holds the content');

    // 2) the userscript's own id shapes still work (release session, field session)
    const b = await req('POST', '/open', { id: 'lq3k2x9ab12cd', content: 'note', ext: 'md', name: 'Edit note' });
    ck(b.status === 200 && /\.md$/.test(b.json && b.json.file || ''), 'a field-editor id (base36) opens');

    // 3) a path in the id is refused, and nothing lands outside the temp folder
    // "x\..\..\probe" is the one that really escapes: the file name is "extedit-<id>.md", so a LEADING
    // ".." only makes a directory called "extedit-.."; after "x\" the two ".." climb out of %TEMP%\extedit.
    for (const bad of ['x\\..\\..\\scribe-traversal-probe', 'x/../../scribe-traversal-probe', '..\\scribe-traversal-probe', 'a/b', '']) {
      const r = await req('POST', '/open', { id: bad, content: 'x', ext: 'md', name: '' });
      ck(r.status === 400, `id ${JSON.stringify(bad)} → refused (${r.status})`);
    }
    ck(!existsSync(PROBE), 'no file was written outside the temp folder: ' + PROBE);

    // 4) the edit → save → /result → /close round trip still works
    const pending = req('GET', '/result?id=rel-abcd1234-kx9q');
    await sleep(600);
    writeFileSync(a.json.file, 'hello, edited');
    const res = await pending;
    ck(res.status === 200 && res.json && res.json.content === 'hello, edited', `a save comes back through /result ("${res.json && res.json.content}")`);
    await req('GET', '/close?id=rel-abcd1234-kx9q'); await req('GET', '/close?id=lq3k2x9ab12cd');
    ck(!existsSync(a.json.file), '/close removes the temp file');
  }
} finally {
  proc.kill();
  if (settingsBackup) writeFileSync(SETTINGS, settingsBackup);   // --editor none was persisted — put the user's editor back
  try { if (existsSync(PROBE)) { unlinkSync(PROBE); console.log('(removed the traversal probe the helper wrote)'); } } catch (e) {}
  console.log('settings restored: ' + (settingsBackup ? readFileSync(SETTINGS, 'utf8') : '(there were none)'));
}
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : (process.exitCode || 0));
