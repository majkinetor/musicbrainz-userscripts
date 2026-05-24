// Align all markdown tables in a file (pad cells with spaces so columns line up).
// Usage:  node dev/align-md-tables.mjs <path-to-md> [<path-to-md> ...]
//
// Detects a table as: a line starting with "|" followed by a separator line
// matching /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.
// Preserves separator alignment hints (`:---`, `:---:`, `---:`).
//
// Rule: if any row's total cell content (sum of cell lengths) exceeds
// MAX_ROW chars, the table is rendered in COMPACT form (`| cell | cell |`
// with single-space padding and minimal `| --- | --- |` separator) instead
// of column-aligned. This keeps long-content tables (e.g. multi-sentence
// cells) from producing very wide lines while still allowing alignment when
// the widest row stays reasonable.

const MAX_ROW = 200;

import { readFile, writeFile } from 'node:fs/promises';

const SEP_RE = /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

function splitRow(line) {
    // Strip leading/trailing pipe, split on |, trim each cell.
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|'))   s = s.slice(0, -1);
    return s.split('|').map(c => c.trim());
}

function detectAlign(sepCell) {
    const t = sepCell.trim();
    const left  = t.startsWith(':');
    const right = t.endsWith(':');
    if (left && right) return 'center';
    if (right)         return 'right';
    return 'left';
}

function padCell(cell, width, align) {
    const pad = width - [...cell].length;
    if (pad <= 0) return cell;
    if (align === 'right')  return ' '.repeat(pad) + cell;
    if (align === 'center') {
        const l = Math.floor(pad / 2);
        return ' '.repeat(l) + cell + ' '.repeat(pad - l);
    }
    return cell + ' '.repeat(pad);
}

function buildSep(width, align) {
    if (align === 'center') return ':' + '-'.repeat(Math.max(1, width - 2)) + ':';
    if (align === 'right')  return '-'.repeat(Math.max(1, width - 1)) + ':';
    return '-'.repeat(Math.max(3, width));
}

function maxRowWidth(rows, sepIdx) {
    let max = 0;
    for (let r = 0; r < rows.length; r++) {
        if (r === sepIdx) continue;
        let sum = 0;
        for (const cell of rows[r]) sum += [...cell].length;
        if (sum > max) max = sum;
    }
    return max;
}

function compactTable(rows, sepIdx) {
    const colCount = Math.max(...rows.map(r => r.length));
    const aligns = rows[sepIdx].map(detectAlign);
    return rows.map((row, r) => {
        const cells = [];
        for (let c = 0; c < colCount; c++) {
            if (r === sepIdx) {
                const a = aligns[c] ?? 'left';
                cells.push(a === 'center' ? ':---:' : a === 'right' ? '---:' : '---');
            } else {
                cells.push(row[c] ?? '');
            }
        }
        return '| ' + cells.join(' | ') + ' |';
    });
}

function alignTable(rows, sepIdx) {
    // If the widest row's total content exceeds MAX_ROW, fall back to compact
    // form — alignment makes the line so long it hurts readability.
    if (maxRowWidth(rows, sepIdx) > MAX_ROW) return compactTable(rows, sepIdx);

    const aligns = rows[sepIdx].map(detectAlign);
    const colCount = Math.max(...rows.map(r => r.length));
    const widths = Array(colCount).fill(0);

    for (let r = 0; r < rows.length; r++) {
        if (r === sepIdx) continue;
        for (let c = 0; c < rows[r].length; c++) {
            widths[c] = Math.max(widths[c], [...rows[r][c]].length);
        }
    }
    // Separator min width = 3 (so cells render as at least `---`)
    for (let c = 0; c < colCount; c++) widths[c] = Math.max(widths[c], 3);

    return rows.map((row, r) => {
        const cells = [];
        for (let c = 0; c < colCount; c++) {
            const cell = row[c] ?? '';
            const align = aligns[c] ?? 'left';
            cells.push(r === sepIdx ? buildSep(widths[c], align) : padCell(cell, widths[c], align));
        }
        return '| ' + cells.join(' | ') + ' |';
    });
}

function processFile(src) {
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.trimStart().startsWith('|') && i + 1 < lines.length && SEP_RE.test(lines[i + 1])) {
            // Collect contiguous table lines
            const rows = [];
            const start = i;
            while (i < lines.length && lines[i].trimStart().startsWith('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            const sepIdx = 1; // by detection, second row is the separator
            out.push(...alignTable(rows, sepIdx));
            continue;
        }
        out.push(line);
        i++;
    }
    return out.join('\n');
}

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Usage: node dev/align-md-tables.mjs <file.md> [...]');
    process.exit(1);
}
for (const f of files) {
    const before = await readFile(f, 'utf8');
    const after  = processFile(before);
    if (before === after) {
        console.log(`unchanged: ${f}`);
        continue;
    }
    await writeFile(f, after);
    console.log(`aligned:   ${f}`);
}
