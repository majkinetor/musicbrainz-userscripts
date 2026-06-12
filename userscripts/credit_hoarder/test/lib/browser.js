// Playwright helpers used by test/run.mjs.
//
// Responsibilities:
//   - Launch persistent context (reuses .pw-profile/ with your logged-in MB cookies + IDB cache).
//   - Inject the built userscript into the MB edit-relationships page.
//   - Drive the import button + review-table confirm button.
//   - Snapshot MB.relationshipEditor.state.relationships before/after.
//   - Provide a no-op for unresolved entities (we don't open creation tabs in tests).

import { chromium }       from 'playwright';
import { readFile }       from 'node:fs/promises';
import { fileURLToPath }  from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE         = dirname(fileURLToPath(import.meta.url));
// Shared repo-level Playwright profile (logged-in MB session), reused by every
// userscript's test harness. From userscripts/discogs_credits/test/lib → repo root.
const PROFILE_DIR  = resolve(HERE, '..', '..', '..', '..', '.pw-profile');
const SCRIPT_PATH  = resolve(HERE, '..', '..', 'dist', 'discogs_credits.user.js');

/**
 * Launches a persistent context. Headless by default; pass {headed:true} when debugging.
 */
export async function launchTestContext({ headed = false } = {}) {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: !headed,
        viewport: { width: 1400, height: 900 },
        // 2x pixel density — full-page screenshots come out crisp instead of
        // ~1400px-wide blurry. Doubles PNG size (typically ~1 MB per shot)
        // but small text on the MB editor stays legible when zoomed in.
        deviceScaleFactor: 2,
    });
    // Block creation-flow popups (we don't want to open MB entity-creation tabs in tests).
    context.on('page', async (page) => {
        const url = page.url();
        if (url && url !== 'about:blank' && /\/(artist|label|place)\/(add|create)/.test(url)) {
            await page.close().catch(() => {});
        }
    });
    return context;
}

/**
 * Opens the release's edit-relationships page and waits for it to be ready.
 * Verifies we're logged in; throws if not.
 *
 * The returned page has a `__captured` property: { console: [...], pageErrors: [...] }
 * Use `getCapturedLog(page)` to read it formatted.
 */
export async function openReleasePage(context, releaseUrl) {
    const page = await context.newPage();

    // Buffer everything the browser prints / throws so we can diagnose hangs.
    const captured = { console: [], pageErrors: [], network: [] };
    page.__captured = captured;
    page.on('console', msg => {
        captured.console.push({
            ts:   new Date().toTimeString().slice(0, 8),
            type: msg.type(),
            text: msg.text(),
        });
    });
    page.on('pageerror', err => {
        captured.pageErrors.push({
            ts:    new Date().toTimeString().slice(0, 8),
            name:  err.name,
            text:  err.message,
            stack: err.stack,
        });
    });
    // HTTP error responses (4xx/5xx). The page's `console` only sees a generic
    // "Failed to load resource: status 404" — we want the URL/method/body too.
    page.on('response', async resp => {
        const status = resp.status();
        if (status < 400) return;
        const req = resp.request();
        let body = '';
        try { body = (await resp.text()).slice(0, 1000); } catch (_) { body = '(body unreadable)'; }
        captured.network.push({
            ts:         new Date().toTimeString().slice(0, 8),
            kind:       'http',
            method:     req.method(),
            url:        req.url(),
            status,
            statusText: resp.statusText(),
            body,
        });
    });
    // True network failures (DNS, connection reset, blocked, etc. — never reached
    // a status code).
    page.on('requestfailed', req => {
        captured.network.push({
            ts:      new Date().toTimeString().slice(0, 8),
            kind:    'fail',
            method:  req.method(),
            url:     req.url(),
            failure: req.failure()?.errorText || '(no error text)',
        });
    });

    const editUrl = releaseUrl.replace(/\/?$/, '') + '/edit-relationships';
    await page.goto(editUrl, { waitUntil: 'domcontentloaded' });

    // Check we're logged in: MB shows /login if not.
    if (page.url().includes('/login')) {
        throw new Error('Not logged in. Run `node test/login.mjs` first.');
    }
    // Wait for MB's relationship editor to mount. MB's edit-relationships page
    // loads a fair amount of JS; on a cold cache 30-60s isn't always enough.
    // NB: page.waitForFunction(fn, arg, options) is positional — passing options
    // as the 2nd arg silently makes it `arg` and reverts timeout to the 30s default.
    await page.waitForFunction(() => {
        const w = /** @type any */ (window);
        return w.MB?.relationshipEditor?.state?.entity;
    }, null, { timeout: 2 * 60_000 });

    return page;
}

/**
 * Returns the page's captured console + page-error log as a formatted string.
 * Cheap to call multiple times — buffers grow as the page runs.
 */
export function getCapturedLog(page) {
    const cap = page.__captured;
    if (!cap) return '';
    const lines = [];
    if (cap.console.length) {
        lines.push('── console ──────────────────────────────────────');
        for (const m of cap.console) lines.push(`[${m.ts}] ${m.type.padEnd(7)} ${m.text}`);
    }
    if (cap.pageErrors.length) {
        lines.push('── page errors ──────────────────────────────────');
        for (const e of cap.pageErrors) {
            lines.push(`[${e.ts}] ${e.name}: ${e.text}`);
            if (e.stack) lines.push(e.stack.split('\n').slice(0, 5).map(l => '    ' + l).join('\n'));
        }
    }
    if (cap.network?.length) {
        lines.push('── network errors (HTTP ≥400 + request failures) ───');
        for (const n of cap.network) {
            if (n.kind === 'http') {
                lines.push(`[${n.ts}] HTTP ${n.status} ${n.statusText}  ${n.method} ${n.url}`);
                if (n.body) {
                    const preview = n.body.trim().split('\n').slice(0, 8).map(l => '    ' + l).join('\n');
                    if (preview) lines.push(preview);
                }
            } else if (n.kind === 'fail') {
                lines.push(`[${n.ts}] FAIL  ${n.method} ${n.url}  (${n.failure})`);
            }
        }
    }
    return lines.join('\n');
}

/**
 * Injects the userscript file into the page (runs in main world).
 * The script's `pageWindow` shim sees plain `window` (no Tampermonkey sandbox).
 */
export async function injectUserscript(page) {
    const code = await readFile(SCRIPT_PATH, 'utf8');
    // Tampermonkey provides `GM_info` and `unsafeWindow`; the script falls back
    // to plain `window` for the latter but expects `GM_info.script.{name,version}`
    // to exist (used in `buildEditNote` and `updateSummary`). Shim it before injecting.
    const shim = `
        window.GM_info = window.GM_info || {
            script: { name: 'Import Discogs Credits (test)', version: 'test' },
            scriptHandler: 'Playwright',
            version: 'test',
        };
    `;
    await page.addScriptTag({ content: shim + code });
    // Wait for the script's import bar to appear (means it's bootstrapped).
    await page.waitForSelector('.discogs-bar .discogs-import-btn', { timeout: 30_000 });
}

/**
 * Snapshots the current relationships on the release entity as plain objects.
 * Returns an array of {id, linkTypeID, e0gid, e1gid, e0type, e1type, e0credit, e1credit, attrs, beginYear, status}
 * suitable for diffing pre/post import.
 */
/**
 * Snapshot the current rel state and split into {all, existing, staged}.
 *
 * MB (as of 2026) stores rels in two flat maps under `re.state`:
 *   - `existingRelationshipsBySource[sourceId] = [rel, ...]` — persisted rels (DB)
 *   - `relationshipsBySource[sourceId]         = [rel, ...]` — persisted + locally-staged edits
 * `staged` is computed as anything in `all` whose rel.id isn't in `existing`.
 *
 * Each plain rel includes both source and target info, attributes, edit status,
 * and (for diagnostics / assertion 6) the source's GID/type/track-position when
 * derivable from `re.state.mediums`.
 */
export async function snapshotRelationships(page) {
    return await page.evaluate(() => {
        const w  = /** @type any */ (window);
        const re = w.MB?.relationshipEditor;
        const errors = [];
        if (!re?.state) return { all: [], existing: [], staged: [], errors: ['no MB.relationshipEditor.state'] };

        // Iterate over either an Array, a Symbol.iterator-collection, or an
        // immutable-tree node (`MB.tree.iterate`).
        function iterAny(node, fn) {
            if (node == null) return;
            const run = x => { try { fn(x); } catch (e) { errors.push(`iter-fn: ${e.message}`); } };
            if (Array.isArray(node))                            { for (const x of node) run(x); return; }
            if (typeof node[Symbol.iterator] === 'function')    { try { for (const x of node) run(x); return; } catch (_) {} }
            try { for (const x of w.MB.tree.iterate(node)) run(x); } catch (_) {}
        }

        function relToPlain(rel) {
            if (!rel || typeof rel !== 'object') return null;

            // MB stores rels in TWO shapes simultaneously:
            //   - OLD shape (used in `relationshipsBySource` and by the userscript's dispatch):
            //         entity0/entity1 = full entity objects, _status: 0|1|2|3, _original, _lineage
            //   - NEW shape (used in `entity.relationships`):
            //         source_id/source_type, entity0_id/entity1_id, target, editsPending
            // Detect which shape this is and normalize.
            const isOld = rel.entity0 != null || rel.entity1 != null;

            let sourceId = null, sourceType = null, sourceGid = null, sourceName = null;
            let targetId = null, targetType = null, targetGid = null, targetName = null;
            let sourceCredit = '', targetCredit = '';
            let editsPending = null;

            if (isOld) {
                // OLD shape. backward=false ⇒ source is entity0; backward=true ⇒ source is entity1.
                const swapped = !!rel.backward;
                const src = swapped ? rel.entity1 : rel.entity0;
                const tgt = swapped ? rel.entity0 : rel.entity1;
                sourceId   = src?.id   ?? null;
                sourceType = src?.entityType ?? null;
                sourceGid  = src?.gid  ?? null;
                sourceName = src?.name ?? null;
                targetId   = tgt?.id   ?? null;
                targetType = tgt?.entityType ?? null;
                targetGid  = tgt?.gid  ?? null;
                targetName = tgt?.name ?? null;
                sourceCredit = swapped ? (rel.entity1_credit || '') : (rel.entity0_credit || '');
                targetCredit = swapped ? (rel.entity0_credit || '') : (rel.entity1_credit || '');
                editsPending = (rel._status != null && rel._status !== 0);
            } else {
                // NEW shape.
                sourceId   = rel.source_id   ?? null;
                sourceType = rel.source_type ?? null;
                const tgt  = rel.target ?? null;
                targetId   = tgt?.id ?? null;
                targetGid  = tgt?.gid ?? null;
                targetType = rel.target_type ?? tgt?.entityType ?? null;
                targetName = tgt?.name ?? null;
                sourceCredit = rel.backward ? (rel.entity1_credit || '') : (rel.entity0_credit || '');
                targetCredit = rel.backward ? (rel.entity0_credit || '') : (rel.entity1_credit || '');
                editsPending = rel.editsPending ?? null;
            }

            const attrs = [];
            iterAny(rel.attributes, a => {
                if (a && (a.typeID != null || a.type?.id != null)) {
                    attrs.push({ typeID: a.typeID ?? a.type?.id, text_value: a.text_value || '' });
                }
            });

            return {
                id:           rel.id,
                linkTypeID:   rel.linkTypeID,
                editsPending,                        // true = staged this session
                status:       rel._status ?? null,   // 0=orig, 1=added, 2=removed, 3=edited (old shape only)
                backward:     !!rel.backward,
                sourceId, sourceType, sourceGid, sourceName,
                targetId, targetType, targetGid, targetName,
                sourceCredit, targetCredit,
                beginYear:    rel.begin_date?.year || null,
                ended:        !!rel.ended,
                linkOrder:    rel.linkOrder ?? 0,
                attrs,
            };
        }

        function collectFromBySource(bySource) {
            const out = [];
            if (!bySource) return out;
            // `relationshipsBySource` is nested five levels deep, mirroring how MB
            // groups rels in its UI:
            //   L1  [sourceId,    targetTypeTree]
            //   L2  [targetType,  linkTypeTree]
            //   L3  { typeId, backward, phraseGroups }      ← one bucket per link type
            //   L4  phraseGroups → { relationships, textPhrase }   ← one bucket per verbose phrase
            //   L5  relationships → individual rel objects (OLD shape: entity0/entity1/_status)
            iterAny(bySource, l1 => {
                const l2tree = Array.isArray(l1) ? l1[1] : l1;
                iterAny(l2tree, l2 => {
                    const l3tree = Array.isArray(l2) ? l2[1] : l2;
                    iterAny(l3tree, ltBucket => {
                        iterAny(ltBucket?.phraseGroups, phrase => {
                            iterAny(phrase?.relationships, rel => {
                                const p = relToPlain(rel);
                                if (p) out.push(p);
                            });
                        });
                    });
                });
            });
            return out;
        }

        // Pull all rels from the editor's source map. Each rel carries `_status` from
        // the old-shape store: 0 = persisted, 1 = newly added this session, 2 = removed,
        // 3 = edited. The same rel can appear under multiple source entries (e.g. once
        // under the release id, once under the artist id) — dedupe by rel.id.
        const allWithDups = collectFromBySource(re.state.relationshipsBySource);
        const seenIds = new Set();
        const all = [];
        for (const r of allWithDups) {
            const k = r.id ?? `auto:${r.linkTypeID}|${r.sourceId}|${r.targetId}|${r.targetCredit}`;
            if (seenIds.has(k)) continue;
            seenIds.add(k);
            all.push(r);
        }
        // staged = rels with _status !== 0 (newly added/edited/removed in this session).
        // persisted (existing) = the rest.
        const staged   = all.filter(r => r.editsPending === true);
        const existing = all.filter(r => r.editsPending !== true);

        // Build source-id → {gid, type, name, trackPos} so assertions can map rels
        // back to recordings/works/the release entity using only rel.source_id.
        // Build sourceId → {gid, name, trackPos, medPos} so assertions can map rels
        // back to a recording position. Old-shape rels already carry sourceGid via the
        // embedded entity0/entity1 objects; this is a backup for cases where they don't.
        const idMap = new Map();
        const entity = re.state.entity;
        if (entity?.id != null) idMap.set(entity.id, { gid: entity.gid, type: entity.entityType || 'release', name: entity.name, trackPos: null });

        iterAny(re.state.mediums, medEntry => {
            const med = Array.isArray(medEntry) ? medEntry[1] : medEntry;
            const medPos = med?.position ?? null;
            iterAny(med?.tracks ?? med, trEntry => {
                const tr = Array.isArray(trEntry) ? trEntry[1] : trEntry;
                const rec = tr?.recording ?? tr;
                if (rec?.id != null) {
                    const tp = tr?.position ?? tr?.number ?? null;
                    idMap.set(rec.id, {
                        gid: rec.gid, type: 'recording', name: rec.name,
                        trackPos: tp != null ? String(tp) : null,
                        medPos:   medPos != null ? String(medPos) : null,
                    });
                }
            });
        });
        // Map works via targets we've seen
        for (const r of all) {
            if (r.targetId != null && r.targetGid && !idMap.has(r.targetId)) {
                idMap.set(r.targetId, { gid: r.targetGid, type: r.targetType, name: r.targetName, trackPos: null });
            }
        }

        function annotate(r) {
            const src = idMap.get(r.sourceId);
            return {
                ...r,
                // Prefer the inline source info already on the rel (old shape carries it);
                // fall back to idMap (new shape rels only have source_id).
                sourceGid:      r.sourceGid   ?? src?.gid   ?? null,
                sourceName:     r.sourceName  ?? src?.name  ?? null,
                sourceTrackPos: src?.trackPos ?? null,
                sourceMedPos:   src?.medPos   ?? null,
            };
        }

        return {
            all:      all.map(annotate),
            existing: existing.map(annotate),
            staged:   staged.map(annotate),
            errors,
        };
    });
}

/**
 * Returns true if the MB-page-level "edit submit" button is present.
 * We do NOT click it. Existence is a sanity check that we're on the right page.
 */
export async function hasSubmitButton(page) {
    return await page.locator('button.submit, button[name="submit"], input[type=submit]').count() > 0;
}

/**
 * Clicks "Import from Discogs". Returns nothing; caller waits for the review table.
 */
export async function clickImport(page) {
    await page.locator('.discogs-bar .discogs-import-btn').first().click();
}

/**
 * Waits for the review table panel to render, then clicks "Start import" (or "Start import anyway").
 * If no review table appears (e.g. everything cached and auto-confirmed), this is a no-op.
 */
export async function confirmReviewTable(page, { timeout = 20 * 60_000 } = {}) {
    // Wait for the panel's "Start import" / "Start import anyway" button.
    //
    // Cold-cache fixtures with many entities (Midwest Funk has 230) can take ~10 min
    // here because preflight queries are rate-limited (MB returns 503/Retry-After).
    // 20-min budget is enough to cover the worst case; subsequent runs are <30s
    // once `.pw-profile/`'s IDB cache is warm.
    const btn = page.locator('button', { hasText: /^Start import/i }).first();
    try {
        await btn.waitFor({ state: 'visible', timeout });
    } catch (e) {
        return false;   // No review table within timeout (preflight stuck, or script crashed)
    }
    await btn.click();
    return true;
}

/** Read the userscript's full log (whatever's currently in the .discogs-output UL).
 *  When an `<li>` contains a `<table>` (the post-import review summary), the table is
 *  rendered as GitHub-flavoured markdown so it stays readable in the saved log instead
 *  of mashing every cell into one unspaced line. */
export async function readImportLog(page) {
    return await page.evaluate(() => {
        const ul = document.querySelector('.discogs-output ul.logs');
        if (!ul) return '';
        function liToText(li) {
            const tbl = li.querySelector('table');
            if (!tbl) return li.textContent.trim();
            // Render the table as markdown. Other text in the `<li>` (rare) is preserved.
            const rows = [...tbl.querySelectorAll('tr')].map(tr =>
                [...tr.children].map(c => (c.textContent || '').replace(/\s*\|\s*/g, ' / ').trim() || ' '));
            if (rows.length === 0) return li.textContent.trim();
            const md = ['| ' + rows[0].join(' | ') + ' |',
                        '| ' + rows[0].map(() => '---').join(' | ') + ' |',
                        ...rows.slice(1).map(r => '| ' + r.join(' | ') + ' |')].join('\n');
            // Preserve any non-table text on the same `<li>` (none in current code, future-proof).
            const tblText = tbl.textContent;
            const liText  = li.textContent;
            const extra   = liText.replace(tblText, '').trim();
            // Wrap with blank lines so the table renders as a real markdown table
            // when this log is pasted into GitHub / Discord / etc. (Standards #8).
            const body = extra ? (extra + '\n\n' + md) : md;
            return '\n' + body + '\n';
        }
        return [...ul.querySelectorAll(':scope > li')].map(liToText).join('\n');
    });
}

/**
 * Waits for the import to finish (import button returns to 'Import from Discogs').
 * Returns `{ log, timedOut }`. On timeout, captures whatever log was produced up to
 * that point — caller decides whether to treat as failure or proceed.
 */
export async function waitForImportDone(page, { timeout = 5 * 60_000 } = {}) {
    let timedOut = false;
    try {
        await page.waitForFunction(
            () => {
                const btn = document.querySelector('.discogs-bar .discogs-import-btn');
                return btn && !btn.disabled && /^Import from Discogs$/i.test(btn.textContent || '');
            },
            null,                            // no arg passed to the page function
            { timeout, polling: 500 },       // 3rd positional = options
        );
    } catch (e) {
        if (/Timeout/i.test(e.message)) timedOut = true;
        else throw e;
    }
    const log = await readImportLog(page);
    return { log, timedOut };
}
