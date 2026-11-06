// The animations the scripts play, each on the script's own element: its markup in the animated state and the rules
// its source ships for it (read by css-of.mjs), so the page shows the real thing, not a stand-in.
//   key    the script folder · label  what plays · html  the element · want  the selectors whose rules it takes
//   extra  CSS that places it in a frame · again  [selector, class] of a one-shot, re-added every few seconds
//   root   attributes for the frame's <html> · eh  Event Horizon's own colour variables

const RADAR = '<svg width="14" height="14" viewBox="0 0 128 128" fill="none" stroke="currentColor"><g stroke-width="8"><circle cx="64" cy="64" r="40"/><circle cx="64" cy="64" r="26" stroke-width="6"/><circle cx="64" cy="64" r="13" stroke-width="6"/></g><g class="ii-sweep"><path d="M64 64 L64 24 A40 40 0 0 1 99 84 Z" fill="currentColor" opacity=".35" stroke="none"/><line x1="64" y1="64" x2="64" y2="24" stroke-width="8" stroke-linecap="round"/><circle cx="86" cy="50" r="9" fill="currentColor" stroke="none"/></g></svg>';
const LINK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
const DISC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
const re = r => s => r.test(s);

/** The demos, given the script sources (`srcOf`) and the icons (`iconOf(key)`, a data URI). */
export function demos(srcOf, iconOf) {
  const logo = cls => (srcOf('event_horizon').match(/const LOGO = '([^']+)'/) || [, ''])[1].replace('<svg', `<svg class="${cls}"`);
  return [
    { key: 'isrc_scout', label: 'ISRC button, loading', want: re(/#ii-btn(?![\w-])|\.ii-sweep/),
      html: `<button id="ii-btn" class="ii-loading">${RADAR}ISRC <span class="ii-status"></span></button>` },
    { key: 'isrc_scout', label: 'ISRC button, ISRCs missing', want: re(/#ii-btn(?![\w-])|\.ii-sweep/),
      html: `<button id="ii-btn" class="has-missing">${RADAR}ISRC <span class="ii-status">3 missing</span></button>` },
    { key: 'isrc_scout', label: 'Submit, collecting', want: re(/#ii-submit|\.ii-tbtn(?![\w-])/),
      html: '<button class="ii-tbtn primary ii-collecting" id="ii-submit">Submit to MusicBrainz</button>' },
    { key: 'isrc_scout', label: 'Link icon, resolving', want: re(/\.ii-tl(?![\w-])/), html: `<span class="ii-tl spin">${LINK}</span>` },
    { key: 'isrc_scout', label: 'Row, just filled', want: re(/\.ii-row-fill/), again: ['tr', 'ii-row-fill'],
      extra: 'td{padding:3px 8px}', html: '<table><tr class="ii-row-fill"><td>1</td><td>Hyperballad</td><td>GBAYE9500213</td></tr></table>' },

    { key: 'apollo_editor', label: 'Artist search, flashed', want: re(/\.tc-search(?![\w-])/), again: ['.tc-search', 'tc-flash'],
      html: '<span class="tc-search"><input class="nm" value="Björk"></span>' },
    { key: 'apollo_editor', label: 'Track title, flashed', want: re(/\.tc-mirror input\.t-title/), again: ['input', 'srflash'],
      html: '<div class="tc-mirror"><input class="t-title" value="Hyperballad" style="width:180px"></div>' },
    { key: 'apollo_editor', label: 'Apollo bar, saving', want: re(/tc-saving/), root: '', body: 'tc-saving',
      extra: '#tc-bar{display:flex;gap:6px;padding:6px 10px;border:1px solid var(--mbu-border)}',
      html: '<div id="tc-bar"><button class="mbu-btn">Tracklist</button><button class="mbu-btn">Recordings</button></div>' },
    { key: 'apollo_editor', label: 'Recording lookup, searching', want: re(/\.tc-rpk-busy|\.tc-rpk-empty/),
      html: '<div class="tc-recpop"><div class="tc-rpk-empty tc-rpk-busy">searching…</div></div>' },
    { key: 'apollo_editor', label: 'Appears on, loading', want: re(/\.tc-rpk-curon|\.tc-rpk-dots/),
      html: '<div class="tc-rpk-curon">appears on: <span class="tc-rpk-curon-list tc-rpk-dots">…</span></div>' },
    { key: 'apollo_editor', label: 'Match button, busy', want: re(/#tc-recwrap \.tc-rec-am|\.tc-spin/),
      html: '<div id="tc-recwrap"><button class="tc-rec-am tc-btn primary busy mbu-btn"><span class="tc-spin"></span><span class="tc-rec-am-lbl">Match</span></button></div>' },
    { key: 'apollo_editor', label: 'Credit, matching', want: re(/\.tc-ri-spin/), html: '<span class="tc-ri-spin"></span>' },

    { key: 'art_station', label: 'Cover art, loading', want: re(/\.as-loading|\.as-spinner/),
      html: '<div class="as-loading"><div class="as-spinner"></div><span>Loading cover art…</span></div>' },
    { key: 'art_station', label: 'Upload progress', want: re(/\.as-cm-bar|\.as-cm-bfill/),
      extra: ':root{--as-acc:var(--mbu-accent);--as-warn:var(--mbu-error)}',
      html: '<div style="width:160px"><span class="as-cm-bar on busy"><span class="as-cm-bfill"></span></span></div>' },

    { key: 'falcon', label: 'Lookup button, busy', want: re(/\.falcon-bar|\.falcon-b[it](?![\w-])|falcon-busy/),
      html: '<div class="falcon-bar"><button class="falcon-busy"><span class="falcon-bi">⟳</span><span class="falcon-bt">Lookup</span></button></div>' },
    { key: 'falcon', label: 'Progress track, running', want: re(/#falcon-progress-track/),
      html: '<div id="falcon-progress-track" class="falcon-running" style="width:160px;height:8px;background:var(--mbu-bg-sunken);border-radius:4px;overflow:hidden"><div style="height:100%;width:35%;background:#2e9e5b"></div></div>' },

    { key: 'first_contact', label: 'Import button, reading', want: s => /#fc-root(?![\w-])/.test(s) && !/fc-iconly|fc-gear|:has\(|fc-panel|fc-pop/.test(s),
      extra: '#fc-root{position:static!important;inset:auto!important}',
      html: '<div id="fc-root"><button class="fc-go" aria-busy="true"><span>Import 3/12</span></button><button class="fc-more">▾</button></div>' },
    { key: 'first_contact', label: 'MusicBrainz light, checking', want: re(/\.fc-light/), html: '<span class="fc-light" data-light="busy"></span>' },

    { key: 'fusion', label: 'Fusing', want: re(/\.fs-busy/), html: '<span class="fs-busy">Fusing…</span>' },

    { key: 'fuzzy_logic', label: 'Source favicon, running', want: re(/\.fl-fav\.run|^\.fl-src \.fl-fav$/),
      html: `<span class="fl-src"><img class="fl-fav run" src="${iconOf('fuzzy_logic')}"></span>` },

    { key: 'group_therapy', label: 'Group, creating', want: re(/\.gt-tp-creating/), html: '<button class="gt-tp-creating">creating “Strings”… ✕</button>' },
    { key: 'group_therapy', label: 'Group, just made', want: re(/\.gt-tp-ring/), again: ['.gt-tp-ring', 'gt-tp-ring'],
      html: '<span class="gt-tp-ring" style="padding:2px 8px">Strings</span>' },

    { key: 'mission_control', label: 'Header and step, busy', want: s => /\.mc-hdr\.mc-busy|\.mc-step|\.mc-ring|\.mc-steps/.test(s) && !/\.mc-step\.(?!busy)|:hover|:focus/.test(s),
      extra: '.mc-hdr{position:relative;padding:8px 12px}',
      html: `<div class="mc-hdr mc-busy"><div class="mc-steps"><span class="mc-step busy"><span class="mc-ring"><img src="${iconOf('isrc_scout')}" width="20" height="20"><sup>3</sup></span><span class="tx"><b>Recordings</b><i>matching…</i></span></span></div></div>` },
    { key: 'mission_control', label: 'Spinners', want: re(/^\.mcc?-spin$/), html: '<span class="mc-spin"></span><span class="mcc-spin"></span>' },

    { key: 'platform_check', label: 'Row, rising', want: s => /#mb-pc-panel \.pc-row(?![\w-])|^\.pc-(cell-ico|cell-name|meta|rows)(?![\w-])/.test(s) && !/pc-layout/.test(s),
      again: ['.pc-row', 'pc-rise'],
      html: `<div id="mb-pc-panel"><div class="pc-rows"><div class="pc-row pc-rise"><span class="pc-cell-ico"><img src="${iconOf('platform_check')}" width="16" height="16"></span><a class="pc-cell-name">MusicBrainz</a><span class="pc-meta">12 tracks</span></div></div></div>` },
    { key: 'platform_check', label: 'Refresh, scanning', want: re(/#mb-refresh-btn|^\.pc-icon-btn(?![\w-])/),
      html: '<span id="mb-refresh-btn" class="pc-icon-btn pc-scanning">↻</span>' },

    { key: 'event_horizon', eh: true, label: 'Page skeleton', want: re(/^\.sk(\.(ti|by))?$/), html: '<div style="width:220px"><div class="sk ti"></div><div class="sk by"></div></div>' },
    { key: 'event_horizon', eh: true, label: 'Logo orbit, checking', want: re(/\.sk-orbit/), extra: '.sk-orbit{width:56px!important;height:56px!important}', html: logo('sk-orbit') },
    { key: 'event_horizon', eh: true, label: 'Status dot', want: re(/\.sk-st|\.sk-dot/), extra: '.sk-st{margin:0!important}',
      html: '<div class="sk-st"><span class="sk-dot"></span><span>Loading <b>Release</b></span></div>' },
    { key: 'event_horizon', eh: true, label: 'Section loading', want: re(/^\.ld$/), html: '<div class="ld"></div>' },
    { key: 'event_horizon', eh: true, label: 'Tag input, looking up', want: re(/\.tgi-spin/),
      html: '<div style="position:relative;width:180px"><input value="ambient" style="width:100%;box-sizing:border-box"><span class="tgi-spin"></span></div>' },
    { key: 'event_horizon', eh: true, label: 'Home orb', want: re(/\.hm-orb/),
      extra: '.hm-orb{position:static!important;width:80px!important;height:80px!important}.hm-orb path{animation-delay:0s,3s!important}', html: logo('hm-orb') },

    { key: 'credit_hoarder', label: 'Artist, creating', want: () => false,
      html: '<div class="ch-creating" style="padding:0.15rem 0.4rem;border:1px dashed var(--mbu-info);border-radius:3px;background:var(--mbu-bg);display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:var(--mbu-info);font-style:italic"><span style="display:inline-block;animation:ch-creating-spin 0.9s linear infinite">⟳</span><span>Creating Björk in the background…</span></div>',
      extra: '@keyframes ch-creating-spin { to { transform: rotate(360deg); } }' },
    { key: 'credit_hoarder', label: 'Source icon, importing', want: re(/^\.discogs-src-ico(?![\w-])(?!\.discogs-src-all)/),
      html: `<button type="button" class="discogs-src-ico importing">${DISC}</button>` },
    { key: 'credit_hoarder', label: 'Toolbar, saving', want: re(/\.discogs-bar\.is-saving/),
      extra: '.discogs-bar{border-left:3px solid var(--mbu-border)}.discogs-bar-row1{padding:6px 10px;border-bottom:1px solid var(--mbu-border)}',
      html: '<div class="discogs-bar is-saving" style="width:220px"><div class="discogs-bar-row1">Saving 12 edits…</div></div>' },

    // news.js builds these rules from a variable, out of reach of css-of: its CSS, as it ships
    { key: 'string_theory', label: 'News, golden icon', want: () => false, root: ' data-st-news',
      extra: `#mbu-dock{position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--mbu-bg)}#mbu-dock img{width:22px;height:22px}
:root[data-st-news] #mbu-dock::before,:root[data-st-news] #mbu-dock::after{content:"";position:absolute;inset:0;box-sizing:border-box;z-index:-1;border:2px solid #ffb300;border-radius:50%;pointer-events:none;animation:st-news-ripple 2.4s ease-out infinite backwards}
:root[data-st-news] #mbu-dock::after{animation-delay:1.2s}
@keyframes st-news-ripple{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(1.7)}}`,
      html: `<div style="position:relative;z-index:0"><div id="mbu-dock"><img src="${iconOf('string_theory')}"></div></div>` },
    { key: 'string_theory', label: 'Sync, running', want: re(/#st-cfg \.st-sync-spinner/), extra: 'h3{margin:0;display:flex;gap:8px;align-items:center}',
      html: '<div id="st-cfg"><h3>Sync<span class="st-sync-spinner" role="status"></span></h3></div>' },
  ];
}
