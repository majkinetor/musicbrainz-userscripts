// Run the import on every fixture URL and assert that the staged relationships
// (those the script just dispatched) are consistent with the Discogs source-of-truth
// and MB's own validity rules.
//
// Usage:
//     pnpm test                          # all fixtures
//     pnpm test -- --headed              # show the browser (for debugging)
//     pnpm test -- --pause               # pause after each fixture for visual inspection
//                                          (implies --headed; Enter to continue, Ctrl-C to abort)
//
//   Filtering (combine freely; AND across flags, OR within --tags list):
//     pnpm test -- --only=fd4c7ae2       # URL or MBID substring (also accepts a 0-based index)
//     pnpm test -- --name=street         # case-insensitive name substring
//     pnpm test -- --tags=small,ep       # match any of the given tags (comma- or space-separated)
//     pnpm test -- --name=bosporus --tags=small
//
// Exit code is 0 only if every selected fixture passes every assertion.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath }              from 'node:url';
import { dirname, resolve }           from 'node:path';
import { createInterface }            from 'node:readline';

import {
    launchTestContext, openReleasePage, injectUserscript,
    snapshotRelationships, clickImport, confirmReviewTable, waitForImportDone,
    getCapturedLog,
} from './lib/browser.js';
import {
    runAssertions, fetchDiscogsJson, fetchMbReleaseJson,
    fetchMbLinkedEntities, getDetectedDiscogsUrl, probeLinkTypesByPhrase,
} from './lib/verify.js';

// ──── args ────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const pause  = args.includes('--pause');
const headed = args.includes('--headed') || pause;   // --pause implies --headed
const arg    = name => {
    const found = args.find(a => a.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : null;
};
const only       = arg('--only');                // URL/MBID substring or 0-based index
const nameFilter = arg('--name');                // case-insensitive name substring
const tagsArg    = arg('--tags');                // comma- or space-separated tag list
const wantedTags = tagsArg ? tagsArg.split(/[,\s]+/).filter(Boolean).map(t => t.toLowerCase()) : null;

const HERE         = dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = resolve(HERE, 'fixtures.json');
const LOG_DIR      = resolve(HERE, 'logs');
await mkdir(LOG_DIR, { recursive: true });

const fixtures = JSON.parse(await readFile(FIXTURE_FILE, 'utf8'));

function matches(fixture, i) {
    if (only) {
        if (!(fixture.url.includes(only) || String(i) === only)) return false;
    }
    if (nameFilter) {
        if (!fixture.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    }
    if (wantedTags) {
        // Accept whitespace or comma as the per-fixture tag separator so authors
        // can write either "a b c" or "a, b, c" without surprises.
        const fixTags = (fixture.tags || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
        if (!wantedTags.some(t => fixTags.includes(t))) return false;
    }
    return true;
}

const selected = fixtures.filter(matches);

if (selected.length === 0) {
    const flags = [
        only       ? `--only=${only}`           : null,
        nameFilter ? `--name=${nameFilter}`     : null,
        tagsArg    ? `--tags=${tagsArg}`        : null,
    ].filter(Boolean).join(' ');
    console.error(`No fixture matches ${flags || '(no filter — fixtures.json is empty?)'}`);
    process.exit(2);
}

// ──── small console helpers ───────────────────────────────────────────────
const c = {
    grey:  s => `\x1b[90m${s}\x1b[0m`,
    red:   s => `\x1b[31m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    amber: s => `\x1b[33m${s}\x1b[0m`,
    bold:  s => `\x1b[1m${s}\x1b[0m`,
};

// HH:MM:SS prefix on every line so step durations are visible.
// Multi-line messages get the prefix on every line for grep/copy friendliness.
function ts() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(...args) {
    const prefix = c.grey(`[${ts()}]`);
    // Preserve blank-line spacing without timestamping it.
    if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('\n')) {
        process.stdout.write('\n');
        console.log(prefix, args[0].slice(1));
    } else {
        console.log(prefix, ...args);
    }
}

// Wait for the user to press Enter on stdin. Used by --pause so they can
// inspect the staged relationships visually before the next fixture loads.
function waitForEnter(prompt) {
    return new Promise(resolve => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, () => { rl.close(); resolve(); });
    });
}

function logFailure(f) {
    if (f.rel) {
        const r = f.rel;
        log(c.red(`    x [${f.kind}] ${f.msg}`));
        log(c.grey(`        rel: ltID=${r.linkTypeID} ${r.sourceType}(${r.sourceName || r.sourceGid?.slice(0,8) || r.sourceId}) -> ${r.targetType}(${r.targetName || r.targetGid?.slice(0,8) || r.targetId})  credit=${JSON.stringify(r.targetCredit)}  trackPos=${r.sourceTrackPos ?? '-'}`));
    } else {
        log(c.red(`    x [${f.kind}] ${f.msg}`));
    }
}

// ──── main ────────────────────────────────────────────────────────────────
const context = await launchTestContext({ headed });
let totalFailures = 0;

for (let i = 0; i < selected.length; i++) {
    const fixture = selected[i];
    const url     = fixture.url;
    const mbid    = url.match(/release\/([a-f0-9-]{36})/)?.[1];
    const header  = `[${i + 1}/${selected.length}] ${fixture.name}`;
    log(c.bold(`\n${header}`));
    log(c.grey(`  ${url}${fixture.tags ? `   [${fixture.tags}]` : ''}`));

    let page;
    try {
        page = await openReleasePage(context, url);

        await injectUserscript(page);
        const discogsUrl = await getDetectedDiscogsUrl(page);
        if (!discogsUrl) {
            log(c.red('  x no Discogs URL detected on this release — skipping'));
            totalFailures++;
            await page.close();
            continue;
        }
        log(c.grey(`  discogs:       ${discogsUrl}`));

        await clickImport(page);
        const sawTable = await confirmReviewTable(page);
        log(c.grey(`  review table:  ${sawTable ? 'confirmed' : 'skipped (cached or none)'}`));

        const { log: importLog, timedOut } = await waitForImportDone(page);

        // Persist BOTH the import-bar log AND the browser console+pageerrors per fixture.
        // Filename: `<ISO8601>_<mbid>.log` so multiple runs accumulate, sorted.
        // Windows file names can't contain `:` so we replace them with `-`.
        const browserLog = getCapturedLog(page);
        const combined =
            `### Userscript import log (from .discogs-output ul.logs)\n\n${importLog || '(empty)\n'}\n\n` +
            `### Browser console + page errors\n\n${browserLog || '(none)\n'}\n`;
        const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const logName = `${stamp}_${mbid}.log`;
        const logPath = resolve(LOG_DIR, logName);
        await writeFile(logPath, combined);
        log(c.grey(`  saved log:     test/logs/${logName}  (${combined.length.toLocaleString()} bytes)`));

        if (timedOut) {
            log(c.red(`  x import timed out — script never returned to idle. Import-log tail:`));
            const tail = importLog.split('\n').slice(-12).join('\n      ');
            log(c.amber(`      ${tail || '(no log)'}`));
            // Surface any uncaught page errors — frequent cause of hangs
            if (page.__captured?.pageErrors?.length) {
                log(c.red(`  page errors during run (${page.__captured.pageErrors.length}):`));
                for (const e of page.__captured.pageErrors.slice(-5)) log(c.red(`      [${e.ts}] ${e.name}: ${e.text}`));
            }
            totalFailures++;
            continue;
        }

        // Single snapshot. Splits into {all, existing, staged} using `_status` from
        // MB's `relationshipsBySource` (staged = `_status` != 0).
        const snap = await snapshotRelationships(page);
        if (snap.errors.length) log(c.amber(`  snapshot warnings: ${snap.errors.slice(0, 3).join('; ')}${snap.errors.length > 3 ? ` (+${snap.errors.length - 3} more)` : ''}`));

        const doneLine = (importLog.split('\n').reverse().find(l => /^Done:/i.test(l.trim())) || '').trim();
        if (doneLine) log(c.grey(`  script says:   ${doneLine}`));
        log(c.grey(`  state rels:    persisted=${snap.existing.length}  staged=${snap.staged.length}  total=${snap.all.length}`));

        // If nothing was staged, dump the log tail so we can see why
        if (snap.staged.length === 0) {
            const tail = importLog.split('\n').slice(-15).join('\n      ');
            log(c.amber(`  import-log tail:\n      ${tail}`));
        }

        // Fetch reference data
        const [linked, discogsJson, mbReleaseJson] = await Promise.all([
            fetchMbLinkedEntities(page),
            fetchDiscogsJson(page, discogsUrl),
            fetchMbReleaseJson(page, mbid),
        ]);

        const { failures, warnings, stats } = runAssertions({
            existingRels: snap.existing,
            finalRels:    snap.all,
            newRels:      snap.staged,
            discogsJson,
            mbReleaseJson,
            linkTypes:    linked.linkTypes,
            attrTypes:    linked.attrTypes,
        });

        const top = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, n2]) => `${n}x${n2}`).join(', ');
        log(c.grey(`  top staged:    ${top || '(none)'}`));

        if (failures.length === 0 && warnings.length === 0) {
            log(c.green(`  OK ${snap.staged.length} staged rels — all assertions pass`));
        } else {
            if (warnings.length) log(c.amber(`  ${warnings.length} warning(s):`));
            for (const w of warnings) log(c.amber(`    ! ${w.msg}`));
            if (failures.length) log(c.red(`  ${failures.length} failure(s):`));
            for (const f of failures) logFailure(f);

            // Bug-#2 diagnostic: for every `invalid_triple` failure, dump all the
            // MB link types whose name/phrase contains the role name. Helps us
            // see which alternate link type the script SHOULD have picked.
            const triples = failures.filter(f => f.kind === 'invalid_triple' && f.rel);
            if (triples.length > 0) {
                const names = [...new Set(triples.map(f => linked.linkTypes[f.rel.linkTypeID]?.name).filter(Boolean))];
                if (names.length) {
                    const probe = await probeLinkTypesByPhrase(page, names);
                    log(c.amber(`  link-type probe for [${names.join(', ')}]:`));
                    for (const p of probe) log(c.amber(`    ltID=${p.id}  name="${p.name}"  ${p.type0}→${p.type1}  fwd="${p.forward}"  rev="${p.reverse}"`));
                }
            }

            totalFailures += failures.length;
        }
    } catch (e) {
        log(c.red(`  x runner error: ${e.message}`));
        if (e.stack) log(c.grey(e.stack.split('\n').slice(1, 4).join('\n')));
        // If we got a page, dump captured browser console+errors and save them.
        if (page?.__captured) {
            const cap = page.__captured;
            if (cap.pageErrors.length) {
                log(c.red(`  page errors during run (${cap.pageErrors.length}):`));
                for (const e2 of cap.pageErrors.slice(-5)) log(c.red(`      [${e2.ts}] ${e2.name}: ${e2.text}`));
            }
            if (cap.console.length) {
                const errs = cap.console.filter(m => m.type === 'error' || m.type === 'warning');
                if (errs.length) {
                    log(c.amber(`  console errors/warnings (${errs.length}):`));
                    for (const m of errs.slice(-5)) log(c.amber(`      [${m.ts}] ${m.type} ${m.text.slice(0, 200)}`));
                }
            }
            try {
                const browserLog = getCapturedLog(page);
                const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                const logName = `${stamp}_${mbid}.log`;
                const logPath = resolve(LOG_DIR, logName);
                await writeFile(logPath, `### Runner error: ${e.message}\n\n### Browser console + page errors\n\n${browserLog || '(none)\n'}\n`);
                log(c.grey(`  saved log:     test/logs/${logName}`));
            } catch (_) { /* ignore log-write errors */ }
        }
        totalFailures++;
    } finally {
        if (pause && page) {
            // Block until the user presses Enter. They can interact with the
            // browser freely during this — we just keep the page alive.
            await waitForEnter(`  -- paused. press Enter to continue, Ctrl-C to abort -- `);
        }
        if (page) await page.close().catch(() => {});
    }
}

await context.close();

if (totalFailures > 0) {
    log(c.red(`\n${totalFailures} assertion failure(s) across ${selected.length} fixture(s).`));
    process.exit(1);
}
log(c.green(`\nOK all ${selected.length} fixture(s) pass.`));
process.exit(0);
