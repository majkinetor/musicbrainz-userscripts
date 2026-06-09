// Unit test for the SHIPPED annotation helpers extract annoToHtml + mdToAnno from the
// userscript by balanced braces and exercise the MB-markup render + the Markdown→MB conversion.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const src = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');

function extract(name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const _annoEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _annoName = new Map();
const annoToHtml = new Function('_annoEsc', '_annoName', `${extract('bulletsToHtml')}\n${extract('annoToHtml')}; return annoToHtml;`)(_annoEsc, _annoName);
const mdToAnno   = new Function(`${extract('mdToAnno')}; return mdToAnno;`)();
const annoToMd   = new Function(`${extract('annoToMd')}; return annoToMd;`)();
const annoContinueBullet = new Function(`${extract('annoContinueBullet')}; return annoContinueBullet;`)();
const annoWrap   = new Function(`${extract('annoWrap')}; return annoWrap;`)();
const annoListSelection = new Function(`${extract('annoListSelection')}; return annoListSelection;`)();

let pass = 0, fail = 0;
const check = (label, got, mustInclude, mustExclude = []) => {
  const okIn = mustInclude.every(s => got.includes(s));
  const okOut = mustExclude.every(s => !got.includes(s));
  if (okIn && okOut) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, '\n        got:', JSON.stringify(got), '\n        want all:', mustInclude, mustExclude.length ? '\n        want none: ' + JSON.stringify(mustExclude) : ''); }
};
const eq = (label, got, want) => { if (got === want) { pass++; console.log('  ok  ', label); } else { fail++; console.log('  FAIL', label, '\n        got: ', JSON.stringify(got), '\n        want:', JSON.stringify(want)); } };

console.log('annoToHtml (MB markup → HTML):');
check('bold + italic', annoToHtml("'''bold''' and ''italic''"), ['<b>bold</b>', '<i>italic</i>']);
check('bold-italic 5-quote', annoToHtml("'''''both'''''"), ['<b><i>both</i></b>']);
check('h1/h2/h3', annoToHtml('= One =\n== Two ==\n=== Three ==='), ['<h1 class="tc-anno-h">One</h1>', '<h2 class="tc-anno-h">Two</h2>', '<h3 class="tc-anno-h">Three</h3>']);
check('labeled link', annoToHtml('see [https://example.com/x|the site]'), ['<a href="https://example.com/x" target="_blank" rel="noopener">the site</a>']);
check('bare link', annoToHtml('visit https://example.com/page here'), ['<a href="https://example.com/page" target="_blank" rel="noopener">https://example.com/page</a>']);
check('plain [url] link', annoToHtml('[https://example.com]'), ['<a href="https://example.com" target="_blank" rel="noopener">https://example.com</a>']);
check('bullets', annoToHtml('    * one\n    * two'), ['<ul class="tc-anno-ul">', '<li>one</li>', '<li>two</li>']);
// nested bullets: MB nests by 4-space-per-level indentation (8sp+* under the previous bullet)
eq('nested bullets render', annoToHtml('    * one\n    * two\n        * sub\n    * three'),
  '<ul class="tc-anno-ul"><li>one</li><li>two<ul class="tc-anno-ul"><li>sub</li></ul></li><li>three</li></ul>');
check('8-space NON-bullet is still code', annoToHtml('        plain code'), ['<pre class="tc-anno-pre">plain code</pre>'], ['<li>']);
// ordered lists: MB uses "a." (auto-numbered) — render <ol>; a literal "1." is NOT a list
eq('ordered "a." list renders <ol>', annoToHtml('    a. one\n    a. two'), '<ol class="tc-anno-ol"><li>one</li><li>two</li></ol>');
check('"1." is not an ordered list (literal)', annoToHtml('    1. one'), [], ['<ol', '<li>']);
check('nested ordered under bullet', annoToHtml('    * a\n        a. b'), ['<ul class="tc-anno-ul"><li>a<ol class="tc-anno-ol"><li>b</li></ol></li></ul>']);
// regression: an empty-title heading (what "# " in Markdown becomes) must NOT infinite-loop the renderer
eq('empty-title heading does not hang', annoToHtml('=  ='), '<p>=  =</p>');
eq('lone "= " does not hang', annoToHtml('= '), '<p>= </p>');
check('bullets + empty heading render (no hang)', annoToHtml('    * a\n        * b\n\n=  ='), ['<li>a<ul', '<li>b</li>', '<p>=  =</p>']);
check('hr', annoToHtml('a\n\n----\n\nb'), ['<hr>']);
check('code block', annoToHtml('        code line'), ['<pre class="tc-anno-pre">code line</pre>']);
check('html escaped', annoToHtml('a <script>x</script> & b'), ['&lt;script&gt;', '&amp; b'], ['<script>']);
check('javascript: not linkified', annoToHtml('[javascript:alert(1)|click]'), ['[javascript:alert(1)|click]'], ['<a href="javascript']);
check('literal brackets via entities', annoToHtml('use &#91;this&#93; literally'), ['use [this] literally'], ['<a ']);
eq('apostrophe in prose untouched', annoToHtml("it's fine"), "<p>it's fine</p>");
// '' inside a URL must not become italics (link is stashed before inline markup runs)
check("quotes inside URL survive", annoToHtml("[https://e.com/a''b|x]"), ['href="https://e.com/a\'\'b"'], ['<i>']);
// resolved-name cache: a bare entity URL shows the cached name as the link label
_annoName.set('https://musicbrainz.org/artist/00000000-0000-0000-0000-000000000001', 'The Artist');
check('cached entity name as label', annoToHtml('https://musicbrainz.org/artist/00000000-0000-0000-0000-000000000001'), ['>The Artist</a>']);

console.log('\nmdToAnno (Markdown → MB markup):');
eq('md link', mdToAnno('[the site](https://example.com/x)'), '[https://example.com/x|the site]');
eq('bold **', mdToAnno('**strong**'), "'''strong'''");
eq('bold __', mdToAnno('__strong__'), "'''strong'''");
eq('italic *', mdToAnno('*soft*'), "''soft''");
eq('italic _', mdToAnno('_soft_'), "''soft''");
eq('heading ##', mdToAnno('## Section'), '== Section ==');
eq('heading clamps to 3', mdToAnno('##### Deep'), '=== Deep ==='); // MB tops out at h3
eq('bullet dash', mdToAnno('- item'), '    * item');
eq('hr ---', mdToAnno('---'), '----');
// a URL containing * or _ must not be italicised by the bold/italic passes (URL is protected)
eq('url with underscores protected', mdToAnno('see https://e.com/a_b_c done'), 'see https://e.com/a_b_c done');
eq('md link url with asterisks protected', mdToAnno('[x](https://e.com/a*b*c)'), '[https://e.com/a*b*c|x]');
// a non-link [x] in Markdown must be encoded so MB doesn't read it as a broken link
eq('non-link [x] encoded', mdToAnno('see [TODO] here'), 'see &#91;TODO&#93; here');
eq('real md link is NOT encoded', mdToAnno('[text](https://e.com)'), '[https://e.com|text]');
eq('encoded brackets decode back', annoToMd('see &#91;TODO&#93; here'), 'see [TODO] here');
eq('[x] round-trips MD→MB→MD', annoToMd(mdToAnno('see [TODO] here')), 'see [TODO] here');
eq('fenced code → 8-space block', mdToAnno('```\nline one\nline two\n```'), '        line one\n        line two');
eq('fenced code with lang tag', mdToAnno('```js\nvar x = 1;\n```'), '        var x = 1;');
eq('markup inside code is left literal', mdToAnno('```\n**not bold** [x](y)\n```'), '        **not bold** [x](y)');
// the blank line between a heading and a following list must survive the conversion
eq('blank line before a list is kept', mdToAnno('### step 1\n\n- 1\n- 2\n- 3'), '=== step 1 ===\n\n    * 1\n    * 2\n    * 3');
eq('blank line after a heading is kept', annoToMd('=== step 1 ===\n\n    * 1\n    * 2'), '### step 1\n\n- 1\n- 2');
// nested bullets convert both ways (markdown 2-space indent <-> MB 4-space level)
eq('md nested bullet → MB', mdToAnno('- a\n  - b\n- c'), '    * a\n        * b\n    * c');
eq('MB nested bullet → md', annoToMd('    * a\n        * b\n    * c'), '- a\n  - b\n- c');
eq('md numbered → MB "a."', mdToAnno('1. one\n2. two'), '    a. one\n    a. two');
eq('MB "a." → md numbered', annoToMd('    a. one\n    a. two'), '1. one\n1. two');
eq('ordered list round-trip (MB→MD→MB)', mdToAnno(annoToMd('    a. x\n        a. y')), '    a. x\n        a. y');
eq('nested bullets round-trip (MB→MD→MB)', mdToAnno(annoToMd('    * a\n        * b\n            * c')), '    * a\n        * b\n            * c');

console.log('\nannoToMd (MB markup → Markdown, the toggle\'s "back" direction):');
eq('link back', annoToMd('[https://example.com/x|the site]'), '[the site](https://example.com/x)');
eq('plain [url] back', annoToMd('[https://example.com]'), 'https://example.com');
eq('[url|] (empty label) back → bare url (not url(url))', annoToMd('[https://e.com/x/annotations|]'), 'https://e.com/x/annotations');
eq('bold back', annoToMd("'''strong'''"), '**strong**');
eq('italic back', annoToMd("''soft''"), '*soft*');
eq('bold-italic back', annoToMd("'''''both'''''"), '***both***');
eq('heading back', annoToMd('== Section =='), '## Section');
eq('bullet back', annoToMd('    * item'), '- item');
eq('hr back', annoToMd('----'), '---');
eq('8-space block → fenced code', annoToMd('        line one\n        line two'), '```\nline one\nline two\n```');
eq('markup inside MB code is left literal', annoToMd("        '''not bold''' [x|y]"), "```\n'''not bold''' [x|y]\n```");

console.log('\nround-trips (toggle stability):');
const rtMB = "= Notes =\nA '''bold''' and ''soft'' note, see [https://e.com/x|the label].\n    * one\n    * two\n----\n        code here\ntail";
eq('MB → MD → MB is stable', mdToAnno(annoToMd(rtMB)), rtMB);
const rtMD = '## Notes\nA **bold** and *soft* note, see [the label](https://e.com/x).\n- one\n- two\n---\n```\ncode here\n```\ntail';
eq('MD → MB → MD is stable', annoToMd(mdToAnno(rtMD)), rtMD);

console.log('\nannoContinueBullet (Enter continues / ends a bullet list):');
const cb = (label, val, pos, want) => { const r = annoContinueBullet(val, pos); eq(label, r && r.value, want.value); if (want.caret != null) eq(label + ' caret', r && r.caret, want.caret); };
cb('continue md bullet', '- one', 5, { value: '- one\n- ', caret: 8 });
cb('continue MB bullet (keeps indent)', '    * one', 9, { value: '    * one\n    * ', caret: 16 });
cb('continue nested bullet', '        * sub', 13, { value: '        * sub\n        * ', caret: 24 });
cb('empty bullet ends the list', '- ', 2, { value: '', caret: 0 });
cb('continue numbered list', '1. one', 6, { value: '1. one\n1. ', caret: 10 });
cb('continue MB "a." list', '    a. one', 10, { value: '    a. one\n    a. ', caret: 18 });
eq('non-bullet line → null', annoContinueBullet('hello', 5), null);

console.log('\nannoListSelection (Tab on a selection cycles plain→bullet→numbered→bullet):');
eq('Tab: plain → bullet (md)', JSON.stringify(annoListSelection('one\ntwo', 0, 7, false)), JSON.stringify({ value: '- one\n- two', selStart: 0, selEnd: 11 }));
eq('Tab again: bullet → numbered (md)', annoListSelection('- one\n- two', 0, 11, false).value, '1. one\n1. two');
eq('Tab again: numbered → bullet (md)', annoListSelection('1. one\n1. two', 0, 12, false).value, '- one\n- two');
eq('Tab: plain → MB bullet (raw)', annoListSelection('one\ntwo', 0, 7, true).value, '    * one\n    * two');
eq('Tab again: MB bullet → "a." (raw)', annoListSelection('    * one\n    * two', 0, 19, true).value, '    a. one\n    a. two');
eq('Shift+Tab removes bullet markers', annoListSelection('- one\n- two', 0, 11, false, true).value, 'one\ntwo');
eq('Shift+Tab removes numbered markers', annoListSelection('1. one\n2. two', 0, 13, false, true).value, 'one\ntwo');
eq('Shift+Tab removes MB "a." markers (raw)', annoListSelection('    a. one\n    a. two', 0, 21, true, true).value, 'one\ntwo');

console.log('\nannoWrap (Ctrl+B/I wrap selection or surround the word):');
const wq = (label, val, s, e, mk, want) => { const r = annoWrap(val, s, e, mk); eq(label, r.value, want); };
wq('wrap a selection', 'hello world', 0, 5, '**', '**hello** world');
wq('surround the word mid-cursor (no selection)', 'hello', 2, 2, '*', '*hello*');
eq('wrap selects the inner text', JSON.stringify(annoWrap('hello', 2, 2, '*')), JSON.stringify({ value: '*hello*', selStart: 1, selEnd: 6 }));
wq('cursor on whitespace inserts empty markers', 'a  b', 2, 2, '**', 'a **** b');

// ── annoResolveNames: add the entity name to links that lack one (mocked WS2 fetch) ──
console.log('\nannoResolveNames (add names to unnamed entity links):');
const A_RE = /https?:\/\/(?:beta\.)?musicbrainz\.org\/(artist|label|area|place|instrument|series|event|genre|release-group|release|recording|work)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const A_FIELD = { artist: 'name', 'release-group': 'title', release: 'title' };
const NAMES = { artist: 'The Artist', 'release-group': 'The Album', release: 'The Release' };
const fakeFetch = async (url) => { const m = url.match(/ws\/2\/([a-z-]+)\//); const type = m && m[1]; return { ok: !!type, json: async () => ({ [A_FIELD[type] || 'name']: NAMES[type] }) }; };
const annoResolveNames = new Function('ANNO_ENTITY_RE', 'ANNO_NAME_FIELD', '_annoName', 'fetch', 'location',
  `${extract('annoReplaceAsync')}\n${extract('annoEntity')}\nasync ${extract('annoLookupName')}\nasync ${extract('annoResolveNames')}\nreturn annoResolveNames;`)(A_RE, A_FIELD, new Map(), fakeFetch, { origin: 'https://musicbrainz.org' });
const U1 = 'https://musicbrainz.org/artist/71616b46-65ae-4a95-96f9-bb792e284baa';
const aeq = async (label, input, want) => { const got = await annoResolveNames(input); eq(label, got, want); };
await aeq('bare entity URL', U1, `[${U1}|The Artist]`);
await aeq('MB [url] (no label)', `[${U1}]`, `[${U1}|The Artist]`);
await aeq('MB [url|] (empty label)', `[${U1}|]`, `[${U1}|The Artist]`);
await aeq('Markdown [](url) empty label', `[](${U1})`, `[The Artist](${U1})`);
await aeq('MB link with existing label left alone', `[${U1}|Keep Me]`, `[${U1}|Keep Me]`);
await aeq('Markdown link with text left alone', `[Keep Me](${U1})`, `[Keep Me](${U1})`);
// entity URL with a trailing path (e.g. /annotations) must still resolve — the bug the user hit
const UREL = 'https://musicbrainz.org/release/00000000-0000-0000-0000-000000000009/annotations';
await aeq('MB [url|] with trailing path', `[${UREL}|]`, `[${UREL}|The Release]`);
await aeq('Markdown [](url) with trailing path', `[](${UREL})`, `[The Release](${UREL})`);
await aeq('bare entity URL with trailing path', UREL, `[${UREL}|The Release]`);
// Markdown mode: bare / [](url) MB URLs are named as Markdown links, not MB syntax
const amd = async (label, input, want) => { const got = await annoResolveNames(input, true); eq(label, got, want); };
await amd('md mode: bare MB url → [Name](url)', U1, `[The Artist](${U1})`);
await amd('md mode: [](url) → [Name](url)', `[](${U1})`, `[The Artist](${U1})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
