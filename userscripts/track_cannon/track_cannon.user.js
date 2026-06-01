// ==UserScript==
// @name         Track Cannon
// @namespace    https://musicbrainz.org/
// @version      2026.6.1.202029
// @description  Speed up per-track artist-credit resolution in the MusicBrainz release editor — bulk-match each track's artist text to an MB artist (sibling releases in the RG first, then search), accept-all, split multi-artist credits, quick-create.
// @author       majkinetor
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/track_cannon/README.md
// @match        https://musicbrainz.org/release/add
// @match        https://musicbrainz.org/release/*/edit
// @match        https://beta.musicbrainz.org/release/add
// @match        https://beta.musicbrainz.org/release/*/edit
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * EARLY SPIKE BUILD — this version's job is to (1) confirm it loads on the release
 * editor, (2) discover the MB.releaseEditor (Knockout) model shape so we can read
 * every track's title + artist credit and later write resolved artists back, and
 * (3) log everything verbosely so the Playwright harness can introspect it.
 */
(function () {
  'use strict';

  /* ── logging — verbose, prefixed, timestamped; the Playwright harness captures
        console.* so these double as the test trace ── */
  const T0 = Date.now();
  const TAG = '[TrackCannon]';
  function ts() { return ((Date.now() - T0) / 1000).toFixed(3) + 's'; }
  const Log = {
    info:  (...a) => console.info(TAG, ts(), ...a),
    warn:  (...a) => console.warn(TAG, ts(), ...a),
    err:   (...a) => console.error(TAG, ts(), ...a),
    group: (n)    => { try { console.group(TAG + ' ' + n); } catch (e) {} },
    end:   ()     => { try { console.groupEnd(); } catch (e) {} },
  };

  Log.info('boot — url:', location.href, '| readyState:', document.readyState);

  // unsafeWindow gives the page's real MB global under Tampermonkey/VM; @grant none
  // (and the Playwright inject) run in the page world where plain window works.
  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;

  /* ── wait for MB.releaseEditor (Knockout app) to mount ── */
  function getEditor() {
    try { return W.MB && W.MB.releaseEditor; } catch (e) { return null; }
  }
  function waitFor(check, { tries = 120, every = 500 } = {}) {
    return new Promise(resolve => {
      let n = 0;
      const tick = () => {
        let v = null; try { v = check(); } catch (e) {}
        if (v) return resolve(v);
        if (++n >= tries) return resolve(null);
        setTimeout(tick, every);
      };
      tick();
    });
  }

  // Knockout observables are functions: call to read. `unwrap` reads either an
  // observable or a plain value, defensively.
  function unwrap(v) {
    try { return typeof v === 'function' ? v() : v; } catch (e) { return undefined; }
  }

  /* ── model discovery: dump the editor structure so we learn the exact paths ── */
  function probeModel(ed) {
    Log.group('model probe');
    try {
      Log.info('MB keys:', Object.keys(W.MB || {}).join(', '));
      Log.info('releaseEditor keys:', Object.keys(ed).join(', '));

      const root = ed.rootField;
      Log.info('rootField?', !!root, '| keys:', root ? Object.keys(root).join(', ') : '—');

      const release = root && unwrap(root.release);
      Log.info('release?', !!release, '| keys:', release ? Object.keys(release).join(', ').slice(0, 300) : '—');
      if (release) {
        Log.info('release.name:', unwrap(release.name), '| gid:', unwrap(release.gid));
        const rg = unwrap(release.releaseGroup);
        Log.info('releaseGroup?', !!rg, '| gid:', rg ? unwrap(rg.gid) : '—', '| name:', rg ? unwrap(rg.name) : '—');
      }

      const mediums = release && unwrap(release.mediums);
      Log.info('mediums?', !!mediums, '| count:', mediums ? mediums.length : '—');

      const med0 = mediums && mediums[0];
      const tracks = med0 && unwrap(med0.tracks);
      Log.info('medium[0].tracks count:', tracks ? tracks.length : '—');

      const t0 = tracks && tracks[0];
      if (t0) {
        Log.info('track[0] keys:', Object.keys(t0).join(', ').slice(0, 400));
        Log.info('track[0] number:', unwrap(t0.number), '| name:', unwrap(t0.name), '| length:', unwrap(t0.length));
        const ac = unwrap(t0.artistCredit);
        Log.info('track[0].artistCredit?', !!ac, '| keys:', ac ? Object.keys(ac).join(', ') : '—');
        const names = ac && unwrap(ac.names);
        Log.info('track[0].artistCredit.names count:', names ? names.length : '—');
        const n0 = names && names[0];
        if (n0) {
          Log.info('name[0] keys:', Object.keys(n0).join(', '));
          const artist = unwrap(n0.artist);
          Log.info('name[0].name(credited):', unwrap(n0.name), '| joinPhrase:', JSON.stringify(unwrap(n0.joinPhrase)));
          Log.info('name[0].artist?', !!artist, '| keys:', artist ? Object.keys(artist).join(', ') : '—',
            '| gid:', artist ? unwrap(artist.gid) : '—', '| name:', artist ? unwrap(artist.name) : '—', '| id:', artist ? unwrap(artist.id) : '—');
        }
      }
    } catch (e) {
      Log.err('probe threw:', e && (e.stack || e.message));
    }
    Log.end();
  }

  /* ── read the tracklist into a plain structure (what the resolver will use) ── */
  function readTracklist(ed) {
    const out = [];
    try {
      const release = unwrap(ed.rootField.release);
      const mediums = unwrap(release.mediums) || [];
      mediums.forEach((med, mi) => {
        const tracks = unwrap(med.tracks) || [];
        tracks.forEach((t, ti) => {
          const ac = unwrap(t.artistCredit) || {};
          const names = (unwrap(ac.names) || []).map(n => {
            const artist = unwrap(n.artist) || null;
            return {
              creditedAs: unwrap(n.name) || '',
              joinPhrase: unwrap(n.joinPhrase) || '',
              artistGid:  artist ? unwrap(artist.gid) : null,
              artistName: artist ? unwrap(artist.name) : '',
              artistId:   artist ? unwrap(artist.id) : null,
            };
          });
          out.push({
            medium: mi, track: ti,
            number: unwrap(t.number), title: unwrap(t.name),
            resolved: names.length > 0 && names.every(n => n.artistGid),
            names,
          });
        });
      });
    } catch (e) {
      Log.err('readTracklist threw:', e && (e.stack || e.message));
    }
    return out;
  }

  // Expose a tiny API on window so the Playwright harness can call it directly.
  W.__trackCannon = { readTracklist: () => readTracklist(getEditor()), probe: () => probeModel(getEditor()) };

  async function main() {
    const ed = await waitFor(() => {
      const e = getEditor();
      // require the release + at least one medium's tracks to be present
      try { return e && unwrap(e.rootField.release) && unwrap(unwrap(e.rootField.release).mediums) ? e : null; }
      catch (x) { return null; }
    });
    if (!ed) { Log.err('MB.releaseEditor never became ready (gave up after waits)'); return; }
    Log.info('editor ready');
    probeModel(ed);

    const tl = readTracklist(ed);
    const slots = tl.reduce((n, t) => n + t.names.length, 0);
    const unresolved = tl.reduce((n, t) => n + t.names.filter(x => !x.artistGid).length, 0);
    Log.info('tracklist:', tl.length, 'tracks ·', slots, 'artist slots ·', unresolved, 'unresolved');
    tl.forEach(t => Log.info('  ', t.number, t.title, '→',
      t.names.map(n => (n.artistGid ? '✓' : '○') + n.artistName + (n.joinPhrase ? '«' + n.joinPhrase.trim() + '»' : '')).join(' ')));

    injectButton();
  }

  function injectButton() {
    if (document.getElementById('tc-btn')) return;
    // sit next to the tracklist tools ("Track parser", "Guess case", …)
    const anchor = [...document.querySelectorAll('button, input[type=button]')]
      .find(b => /track parser|guess case|reset track numbers/i.test(b.textContent || b.value || ''));
    const btn = document.createElement('button');
    btn.id = 'tc-btn'; btn.type = 'button'; btn.textContent = '🎯 Track Cannon';
    btn.style.cssText = 'margin-left:8px;font-weight:600;';
    btn.addEventListener('click', () => { Log.info('button click — re-probe'); const ed = getEditor(); if (ed) { probeModel(ed); console.table(readTracklist(ed)); } });
    if (anchor && anchor.parentElement) anchor.parentElement.appendChild(btn);
    else (document.querySelector('#tracklist, .tracklist, #content') || document.body).prepend(btn);
    Log.info('button injected', anchor ? '(next to tools)' : '(fallback location)');
  }

  main();
})();
