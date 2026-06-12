// ESLint v9 flat config.
//
// Goal for commit 1: catch the bug class we've burned time on (dangling
// expression statements, unreachable code, duplicate keys, syntax glitches)
// without erroring on the legacy patterns we're about to delete in commit 3
// (massive amounts of `no-undef` / `no-unused-vars`).
//
// After commit 3 cleanup, promote `no-undef` and `no-unused-vars` to 'error'.

export default [
    {
        files:  ['src/**/*.js'],
        ignores: ['dist/**', 'node_modules/**', '.pw-profile/**', 'test/**'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals: {
                // Browser
                window:                 'readonly',
                document:               'readonly',
                navigator:              'readonly',
                location:               'readonly',
                fetch:                  'readonly',
                console:                'readonly',
                setTimeout:             'readonly',
                clearTimeout:           'readonly',
                setInterval:            'readonly',
                clearInterval:          'readonly',
                AbortController:        'readonly',
                performance:            'readonly',
                requestAnimationFrame:  'readonly',
                cancelAnimationFrame:   'readonly',
                localStorage:           'readonly',
                sessionStorage:         'readonly',
                indexedDB:              'readonly',
                IDBKeyRange:            'readonly',
                BroadcastChannel:       'readonly',
                MutationObserver:       'readonly',
                URL:                    'readonly',
                URLSearchParams:        'readonly',
                FormData:               'readonly',
                Blob:                   'readonly',
                Event:                  'readonly',
                CustomEvent:            'readonly',
                KeyboardEvent:          'readonly',
                MouseEvent:             'readonly',
                PointerEvent:           'readonly',
                Node:                   'readonly',
                Element:                'readonly',
                HTMLElement:            'readonly',
                Image:                  'readonly',
                getComputedStyle:       'readonly',
                CSS:                    'readonly',
                NodeFilter:             'readonly',
                Highlight:              'readonly',
                Range:                  'readonly',
                // Greasemonkey / Tampermonkey
                unsafeWindow:           'readonly',
                GM_info:                'readonly',
                GM_setValue:            'readonly',
                GM_getValue:            'readonly',
                GM_deleteValue:         'readonly',
                GM_xmlhttpRequest:      'readonly',
                GM_addStyle:            'readonly',
                GM_openInTab:           'readonly',
                // jQuery (loaded by the MB page)
                $:                      'readonly',
                jQuery:                 'readonly',
                // MB page object (accessed via unsafeWindow, but referenced directly in legacy code)
                MB:                     'readonly',
            },
        },
        rules: {
            // ── Catch real bugs (these failed us in production) ──────────────
            'no-unused-expressions':    ['error', { allowShortCircuit: true, allowTernary: true }],
            'no-unreachable':           'error',
            'no-dupe-keys':             'error',
            'no-dupe-args':             'error',
            'no-dupe-else-if':          'error',
            'no-duplicate-case':        'error',
            'no-func-assign':           'error',
            'no-class-assign':          'error',
            'no-const-assign':          'error',
            'no-self-assign':           'error',
            'no-self-compare':          'error',
            'no-irregular-whitespace':  'error',
            'use-isnan':                'error',
            'valid-typeof':             'error',
            'no-misleading-character-class': 'error',
            'no-async-promise-executor':     'error',
            'no-compare-neg-zero':           'error',
            'no-sparse-arrays':              'error',
            'no-unsafe-finally':             'error',
            'no-unsafe-negation':            'error',

            // ── Style/hygiene — warnings only for now ────────────────────────
            'no-cond-assign':           'warn',
            'no-empty':                ['warn', { allowEmptyCatch: true }],

            // ── On now that the source split is in (was 'off' under
            //     `sourceType: 'script'` to suppress legacy noise; flipping
            //     them to 'error' caught two real undef ReferenceErrors —
            //     `DISCOGS_CHANNEL` in review-table, `discogsUrl` in
            //     dispatch — that the test gate's try/catch was swallowing.)
            'no-undef':                 'error',
            'no-prototype-builtins':    'off',
            // 'no-unused-vars' deliberately still 'off' — the modules
            // import things they don't use yet (intentionally — keeps the
            // import surface intact during incremental work).
            'no-unused-vars':           'off',
        },
    },
];
