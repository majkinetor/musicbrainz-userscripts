#!/usr/bin/env node
// Checks script READMEs against Standard 12 (STANDARDS.md → Script READMEs) and the
// Markdown standards 8 and 11. It finds what a rule can find; the writing itself
// (plain words, said once, user's view) still needs a reader.
//
//   node dev/check-readme.mjs                      every userscripts/*/README.md
//   node dev/check-readme.mjs <file.md> [...]      just these
//
// Exit 1 on an error; warnings are printed but don't fail.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = ['Features', 'Settings', 'Shortcuts', 'Notes'];
// Scripts whose README isn't a script README of the usual shape.
const SKIP = new Set(['discogs_credits', 'string_theory']);

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => resolve(f))
  : readdirSync(join(ROOT, 'userscripts'))
    .filter(d => !SKIP.has(d) && existsSync(join(ROOT, 'userscripts', d, 'README.md')))
    .map(d => join(ROOT, 'userscripts', d, 'README.md'));

// GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens.
const slug = h => h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

let errors = 0, warnings = 0;

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
  const out = [];
  const err = (n, m) => { out.push(`  ✗ ${n ? `${n}: ` : ''}${m}`); errors++; };
  const warn = (n, m) => { out.push(`  ⚠ ${n ? `${n}: ` : ''}${m}`); warnings++; };

  // Code blocks are left alone by every check.
  let inCode = false;
  const code = lines.map(l => { if (/^\s*```/.test(l)) { inCode = !inCode; return true; } return inCode; });

  const heads = [];
  lines.forEach((l, i) => { const m = !code[i] && /^(#{1,6})\s+(.*)$/.exec(l); if (m) heads.push({ i, level: m[1].length, text: m[2].trim() }); });
  const anchors = new Set(heads.map(h => slug(h.text)));
  const h2 = heads.filter(h => h.level === 2);

  // Standard 8: a blank line before and after every heading.
  for (const h of heads) {
    if (h.i > 0 && lines[h.i - 1].trim() !== '') err(h.i + 1, `no blank line before "${h.text}" (Standard 8)`);
    if (h.i < lines.length - 1 && lines[h.i + 1].trim() !== '') err(h.i + 1, `no blank line after "${h.text}" (Standard 8)`);
  }

  // Shape: title and pitch, install links, Features, its sections, Settings, Shortcuts, Notes.
  if (!heads.length || heads[0].level !== 1) err(1, 'starts without the # title');
  const head = lines.slice(0, h2[0]?.i ?? lines.length).join('\n');
  if (!/refs\/heads\/stable\//.test(head) || !/refs\/heads\/main\//.test(head)) warn(0, 'the stable and latest install links are missing above the first section');
  if (!/CHANGELOG\.md/.test(head)) warn(0, 'no changelog link above the first section');
  const hasFeatures = h2.some(h => !FIXED.includes(h.text));
  if (h2[0]?.text !== 'Features' && hasFeatures) err(h2[0] ? h2[0].i + 1 : 0, 'the first section is not ## Features');

  const fixedAt = Object.fromEntries(FIXED.map(f => [f, h2.findIndex(h => h.text === f)]));
  const tail = ['Settings', 'Shortcuts', 'Notes'].filter(f => fixedAt[f] >= 0);
  if (hasFeatures) for (let k = 1; k < tail.length; k++) if (fixedAt[tail[k]] < fixedAt[tail[k - 1]]) err(h2[fixedAt[tail[k]]].i + 1, `${tail[k]} comes before ${tail[k - 1]}`);
  if (hasFeatures && tail.length && fixedAt[tail.at(-1)] !== h2.length - 1) err(h2[fixedAt[tail.at(-1)] + 1].i + 1, `"${h2[fixedAt[tail.at(-1)] + 1].text}" comes after ${tail.at(-1)}; feature sections go before Settings`);
  for (const h of h2) if (!FIXED.includes(h.text) && /^(installation|install|usage|how to use|configuration|options|faq|known issues|changelog|credits)$/i.test(h.text)) warn(h.i + 1, `"${h.text}" isn't part of the shape; it belongs in a feature section, Settings or Notes`);

  // The Features list: one line each, a link to its section, in the sections' order.
  if (fixedAt.Features >= 0) {
    const start = h2[fixedAt.Features].i + 1, end = h2[fixedAt.Features + 1]?.i ?? lines.length;
    const linked = [];
    // After the list, one short paragraph may say how the features fit together.
    let afterList = 0, seenItem = false;
    for (let i = start; i < end; i++) {
      const l = lines[i];
      if (!l.trim() || code[i]) continue;
      if (/^\s*>/.test(l)) continue;
      const m = /^\s*[-*]\s+\*\*\[([^\]]+)\]\(#([^)]+)\)\*\*/.exec(l);
      if (!m) {
        if (/^\s*[-*]\s/.test(l)) { warn(i + 1, 'a Features item without a **[Name](#section)** link; give it a section or move it into one'); seenItem = true; continue; }
        if (seenItem && ++afterList === 1 && /^[^|<!]/.test(l)) { if (l.length > 400) warn(i + 1, `the paragraph after the Features list is ${l.length} chars; keep it to a line or two`); continue; }
        warn(i + 1, "more than one short paragraph in Features; detail goes in the feature's section");
        continue;
      }
      seenItem = true;
      if (!anchors.has(m[2])) err(i + 1, `Features links #${m[2]}, which no heading makes`);
      if (['settings', 'shortcuts', 'notes'].includes(slug(m[1]))) warn(i + 1, `#${m[2]} isn't a feature; it has its own section after the features`);
      linked.push(m[2]);
      if (l.length > 220) warn(i + 1, `a long Features line (${l.length} chars); one line, no detail`);
    }
    const sections = h2.filter(h => !FIXED.includes(h.text)).map(h => slug(h.text));
    // A reference section (Platforms, Providers) may be linked from inside a feature's line instead.
    const mentioned = new Set(lines.slice(start, end).flatMap(l => [...l.matchAll(/\]\(#([^)]+)\)/g)].map(m => m[1])));
    for (const s of sections) if (!mentioned.has(s)) warn(0, `section #${s} isn't in the Features list`);
    const order = [...new Set(linked.filter(a => sections.includes(a)))];
    const secOrder = sections.filter(s => order.includes(s));
    if (order.join() !== secOrder.join()) warn(0, 'the Features list and the sections are in different orders');
  }

  // Settings and Shortcuts are tables.
  for (const [name, col] of [['Settings', /^\|\s*(Setting\s*\|\s*Default|Section)\s*\|/], ['Shortcuts', /^\|\s*(Key|Shortcut|Gesture|Where)\b/]]) {
    if (fixedAt[name] < 0) continue;
    const start = h2[fixedAt[name]].i + 1, end = h2[fixedAt[name] + 1]?.i ?? lines.length;
    const tables = lines.slice(start, end).filter(l => /^\|/.test(l));
    if (!tables.length) warn(start, `${name} has no table`);
    else if (!lines.slice(start, end).some(l => col.test(l))) warn(start, `${name}'s table doesn't start with the usual columns (${name === 'Settings' ? 'Setting · Default · …' : 'Key · Where · …'})`);
    if (name === 'Settings') for (let i = start; i < end; i++) {
      if (!/^\|/.test(lines[i]) || /^\|[\s|:-]+\|?$/.test(lines[i]) || col.test(lines[i])) continue;
      const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
      if (cells.length >= 3 && !cells[cells.length - 1]) warn(i + 1, `setting "${cells[0]}" doesn't say what it does`);
    }
  }

  // Inside the prose.
  const notesAt = fixedAt.Notes >= 0 ? h2[fixedAt.Notes].i : Infinity;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (code[i] || /^#/.test(l)) continue;
    const text = l.replace(/`[^`]*`/g, '``').replace(/\]\([^)]*\)/g, ']()').replace(/<[^>]+>/g, '');

    // No history in the prose.
    const hist = /\(#\d+\)|\bsince #\d+|\bused to\b|\bis now\b|\bare now\b|\bnow (?:also )?(?:shows?|opens?|uses?|reads?|goes|works|brings)\b|\bpreviously\b|\banymore\b/i.exec(text);
    if (hist) warn(i + 1, `history in the prose: "${hist[0]}"`);
    if (/(^|[^\w/[])#\d{2,}\b/.test(text)) warn(i + 1, 'an issue number in the prose; the issues keep the history');

    // No internals outside Notes.
    if (i < notesAt) {
      const raw = l.replace(/\]\([^)]*\)/g, ']()');
      const m = /\b(localStorage|sessionStorage|IndexedDB|GM_[a-zA-Z]+|querySelector\w*|XMLHttpRequest|fetch\(|postMessage|MutationObserver|setTimeout|\/ws\/(?:js|2)\b|endpoint|api key|access token|bearer|client[_ ]id|CSS selector|\bmbuShared\b|\bdata-[a-z-]+=)/i.exec(raw);
      if (m) warn(i + 1, `low-level detail "${m[1]}" outside Notes; it belongs in DEVELOP.md`);
      if (/\b\d{2,5}\s?ms\b/.test(text)) warn(i + 1, 'a timing in ms; say what the user sees');
    }

    // Tables keep short facts.
    if (/^\|/.test(l) && !/^\|[\s|:-]+\|?$/.test(l)) {
      const cells = l.split('|').slice(1, -1).map(c => c.trim().replace(/\]\([^)]*\)/g, ']'));
      const long = cells.filter(c => c.length > 90);
      if (long.length) warn(i + 1, `a table cell of ${Math.max(...long.map(c => c.length))} chars; long text goes under its own heading below the table`);
    }

    // Standard 11: no hard-wrapped prose.
    const prose = s => s.trim() && !/^\s*([-*+]|\d+\.)\s|^\s*[|>#<]|^\s*$|^\s*!\[|^\[[^\]]+\]:\s/.test(s);
    if (i > 0 && !code[i - 1] && prose(l) && prose(lines[i - 1]) && !/ {2}$/.test(lines[i - 1])) warn(i + 1, 'looks hard-wrapped (two prose lines in a row); one paragraph is one line (Standard 11)');
  }

  // A > [!NOTE] goes at the end of its section.
  for (let i = 0; i < lines.length; i++) {
    // Above the first section, a notice belongs to the pitch, not to a section.
    if (code[i] || !/^>\s*\[!NOTE\]/i.test(lines[i]) || i < (h2[0]?.i ?? 0)) continue;
    let j = i + 1;
    while (j < lines.length && /^>/.test(lines[j])) j++;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && !/^#/.test(lines[j])) warn(i + 1, 'a > [!NOTE] in the middle of its section; it goes at the end');
  }

  // Screenshots are the script's own.
  for (let i = 1; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/(?:src="|\]\()(\.\/)?([^")]+\.(?:png|jpe?g|gif|webp))/gi)) {
      if (/^https?:/.test(m[2])) continue;
      if (!/^screenshots\//.test(m[2])) warn(i + 1, `image ${m[2]} isn't in the script's screenshots/ folder`);
      else if (!existsSync(join(dirname(file), m[2]))) err(i + 1, `image ${m[2]} doesn't exist`);
    }
  }

  // Links to this README's own sections resolve.
  for (let i = 0; i < lines.length; i++) {
    if (code[i]) continue;
    for (const m of lines[i].matchAll(/\]\(#([^)]+)\)/g)) if (!anchors.has(m[1])) err(i + 1, `#${m[1]} links no heading`);
  }

  console.log(`${out.length ? (out.some(o => o.includes('✗')) ? '✗' : '⚠') : '✓'} ${rel}`);
  for (const o of out) console.log(o);
}

console.log(`\n${files.length} README${files.length === 1 ? '' : 's'}: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`);
process.exit(errors ? 1 : 0);
