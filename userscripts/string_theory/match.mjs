// A member's own URL patterns, as a userscript manager reads them (#710). The bundle's @match is the
// union of every member's, so the build gates each body with the member's own patterns: a member
// then starts only where its standalone copy would.
//
//   @match / @exclude-match   match patterns: <scheme>://<host><path>, '*' wildcards
//                             (scheme * = http or https; host *.x = x or any subdomain of it;
//                             the path, query included, matches with * as "anything")
//   @include / @exclude       globs over the whole URL ('*' = anything), or /regex/
//
// Each pattern compiles to a RegExp source tested against location.href without its #hash.

const esc = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const glob = s => esc(s).replace(/\*/g, '.*');

export function matchPatternSource(p) {
  if (p === '<all_urls>') return '^(?:https?|file|ftp):\\/\\/.*$';
  const m = p.match(/^(\*|[a-z][a-z0-9+.-]*):\/\/([^/]*)(\/.*)?$/i);
  if (!m) throw new Error(`not a match pattern: ${p}`);
  const [, scheme, host, path = '/'] = m;
  const s = scheme === '*' ? 'https?' : esc(scheme.toLowerCase());
  const h = host === '*' ? '[^/]*'
    : host.startsWith('*.') ? `(?:[^/]*\\.)?${esc(host.slice(2))}(?::\\d+)?`
    : `${esc(host)}(?::\\d+)?`;
  return `^${s}:\\/\\/${h}${glob(path)}$`;
}

export function includeSource(p) {
  const re = p.match(/^\/(.*)\/([a-z]*)$/);
  if (re) return re[1];
  return `^${glob(p)}$`;
}

// [k, v] metadata pairs → { inc: [sources], exc: [sources], noframes }
export function urlRules(meta) {
  const inc = [], exc = [];
  let noframes = false;
  for (const [k, v] of meta) {
    if (k === 'match') inc.push(matchPatternSource(v));
    else if (k === 'include') inc.push(includeSource(v));
    else if (k === 'exclude-match') exc.push(matchPatternSource(v));
    else if (k === 'exclude') exc.push(includeSource(v));
    else if (k === 'noframes') noframes = true;
  }
  return { inc, exc, noframes };
}

// What the bundle runs in the page: does a member with these rules start on this URL, in this frame?
// A member without @match/@include runs everywhere the bundle does.
export function runsHere(rules, href, inFrame) {
  if (rules.noframes && inFrame) return false;
  const url = String(href).replace(/#.*$/, '');
  const any = list => list.some(src => new RegExp(src).test(url));
  return (!rules.inc.length || any(rules.inc)) && !any(rules.exc);
}
