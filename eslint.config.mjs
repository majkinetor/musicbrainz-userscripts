// Repo-wide lint for every userscript (#623): the bug classes that have cost us
// real time — undefined names, duplicate keys, unreachable code, a `$` that only
// exists on some pages — as errors; dead code as warnings. Run by the pre-commit
// hook on staged scripts and by CI on all of them:
//
//   pnpm lint            every script
//   pnpm exec eslint <files>
//
// Credit Hoarder's src/ keeps its own config (ESLint looks up the nearest one per
// file) and its own gate: pnpm --dir userscripts/credit_hoarder run lint.
import globals from 'globals';

const gm = Object.fromEntries(['unsafeWindow', 'GM_info', 'GM', 'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_listValues',
  'GM_addValueChangeListener', 'GM_removeValueChangeListener', 'GM_xmlhttpRequest', 'GM_addStyle', 'GM_openInTab',
  'GM_registerMenuCommand', 'GM_unregisterMenuCommand', 'GM_cookie', 'GM_setClipboard', 'GM_download', 'GM_notification',
  'cloneInto', 'exportFunction'].map(k => [k, 'readonly']));

const rules = {
  // real bugs
  'no-undef': 'error',
  'no-dupe-keys': 'error', 'no-duplicate-case': 'error', 'no-dupe-else-if': 'error', 'no-dupe-class-members': 'error',
  'no-unreachable': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error', 'no-redeclare': 'error',
  'no-cond-assign': ['error', 'except-parens'], 'no-constant-binary-expression': 'error', 'no-unsafe-finally': 'error',
  'use-isnan': 'error', 'valid-typeof': 'error', 'no-loss-of-precision': 'error',
  'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
  'no-async-promise-executor': 'error', 'getter-return': 'error', 'no-setter-return': 'error',
  'no-shadow-restricted-names': 'error', 'no-sparse-arrays': 'error', 'no-unsafe-negation': 'error', 'no-unsafe-optional-chaining': 'error',
  'no-useless-backreference': 'error', 'no-misleading-character-class': 'error', 'no-empty-character-class': 'error',
  'no-func-assign': 'error', 'no-const-assign': 'error', 'no-class-assign': 'error', 'no-global-assign': 'error', 'no-invalid-regexp': 'error',
  // worth a look, not a blocker
  // the shared generated blocks (ST-UI, ST-MATCH, ST-ICONS) carry every helper to every
  // script; one a script doesn't call is not dead code
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^(_|mbu[A-Z]|mbm[A-Z]|MBM_|mbn[A-Z]|MBN_|mbRestackCorner$|st[A-Z])' }],
  'no-template-curly-in-string': 'warn', 'no-unmodified-loop-condition': 'warn', 'array-callback-return': 'warn', 'no-fallthrough': 'warn',
  'no-constant-condition': ['warn', { checkLoops: false }],
  'no-irregular-whitespace': ['warn', { skipStrings: true, skipTemplates: true, skipRegExps: true }],   // thin spaces in UI text are meant
  'no-control-regex': 'off',
};

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'userscripts/discogs_credits/**', 'userscripts/string_theory/**', 'userscripts/*/test/**', 'userscripts/*/dev/**', 'test-results/**'] },
  {
    // the monolithic scripts, as a userscript manager runs them
    files: ['userscripts/**/*.user.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...gm } },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules,
  },
];
