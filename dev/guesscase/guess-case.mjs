// Guess case without MusicBrainz's editors (#785): MusicBrainz's own guess case
// (root/static/scripts/guess-case, metabrainz/musicbrainz-server @7224306c, 2026-10-14),
// ported to one self-contained block, plus modes and options of ours.
//
// Inlined between `// <ST-GUESSCASE>` markers by dev/guesscase/sync-guesscase.mjs: the block
// is this file's text up to the END-OF-BLOCK line. Edit HERE, never in a generated block.
// API: dev/guesscase/README.md.
//
// The port keeps MusicBrainz's code as it is, so its results stay MusicBrainz's (the spec
// holds a few hundred titles guessed by MusicBrainz itself): the Flow types are gone, the
// module-wide flags became one context object per call, and what MusicBrainz reads from
// cookies (mode, keep uppercase, roman numerals) comes in as options.
//
// MusicBrainz's guess case: Copyright (C) 2005 Stefan Kestenholz (keschte), Copyright (C)
// 2010-2021 MetaBrainz Foundation; GPL version 2, or (at your option) any later version.

const mbuGuessCase = (() => {
    'use strict';

    const empty = v => v === null || v === undefined || v === '';
    const nonEmpty = v => !empty(v);
    const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
    const escapeRegExp = s => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
    const capitalize = s => s[0].toUpperCase() + s.slice(1).toLowerCase();
    // utils/trim.js
    const trim = w => clean(w).replace(/([([])\s+/, '$1').replace(/\s+([)\]])/, '$1');

    // ── flags.js: the state of one run ──────────────────────────────────────────────────
    const BRACKET_PAIRS = [['(', ')'], ['[', ']'], ['<', '>'], ['（', '）'], ['［', '］'], ['{', '}'], ['【', '】']];
    const bracketChars = new RegExp('^[' + escapeRegExp(BRACKET_PAIRS.flat().join('')) + ']$');
    const bracketPairs = BRACKET_PAIRS.reduce((r, [o, c]) => { r[o] = c; r[c] = o; return r; }, {});

    class Flags {
        constructor() { this.context = {}; this.init(); }
        resetContext() {
            const c = this.context;
            c.acronym_split = false; c.colon = false; c.ellipsis = false; c.hyphen = false;
            c.openingBracket = false; c.singlequote = false; c.whitespace = false;
        }
        isInsideBrackets() { return this.context.openBrackets.length > 0; }
        pushBracket(b) { this.context.openBrackets.push(b); }
        popBracket() { const cb = this.getCurrentCloseBracket(); this.context.openBrackets.pop(); return cb; }
        getCurrentCloseBracket() {
            const ob = this.context.openBrackets[this.context.openBrackets.length - 1];
            return ob ? (bracketChars.test(ob) ? bracketPairs[ob] : '') : null;
        }
        init() {
            const c = this.context;
            c.forceCaps = true;            // the first word is always capitalized
            c.spaceNextWord = false;
            c.openBrackets = [];
            c.slurpExtraTitleInformation = false;
            this.resetContext();
            c.acronym = false;
            c.number = false;
            c.openedSingleQuote = false;
            c.numberSplitChar = null;      // the first split seen is the only one for the string
            c.numberSplitExpect = false;
        }
    }

    // ── utils/wordCheckers.js ────────────────────────────────────────────────────────────
    // turned to lowercase in brackets, but not put in brackets at the end of the title
    const preBracketSingleWordsList = ['acoustic', 'airplay', 'album', 'alternate', 'alternative', 'ambient', 'bit', 'bonus', 'censored', 'chillout', 'clean', 'club', 'composition', 'cut', 'dance', 'dialogue', 'dirty', 'disc', 'disco', 'dub', 'early', 'explicit', 'extended', 'feat', 'featuring', 'ft', 'instrumental', 'live', 'long', 'loop', 'main', 'megamix', 'mix', 'official', 'original', 'piano', 'radio', 'rap', 'rehearsal', 'remixed', 'remode', 'rework', 'reworked', 'session', 'short', 'single', 'studio', 'take', 'takes', 'techno', 'trance', 'uncensored', 'unknown', 'untitled', 'version', 'video', 'vocal', 'with', 'without'];
    const preBracketSingleWords = new RegExp('^(' + preBracketSingleWordsList.join('|') + ')$', 'i');
    const isPrepBracketSingleWord = w => preBracketSingleWords.test(w);
    // turned to lowercase in brackets, and put in brackets at the end of the title
    const lowerCaseBracketWordsList = ['a_cappella', 'clubmix', 'demo', 'edit', 'excerpt', 'interlude', 'intro', 'karaoke', 'maxi', 'mono', 'orchestral', 'outro', 'outtake', 'outtakes', 'quadraphonic', 'reedit', 're_edit', 'refix', 'reinterpreted', 'remake', 'remaster', 'remastered', 'remix', 'rmx', 'reprise', 'skit', 'stereo', 'unplugged', 'vs'].concat(preBracketSingleWordsList);
    const lowerCaseBracketWords = new RegExp('^(' + lowerCaseBracketWordsList.join('|') + ')$', 'i');
    const isLowerCaseBracketWord = w => w != null && lowerCaseBracketWords.test(w);
    const prepBracketWords = /^(?:cd|disk|12["”]|7["”]|a_cappella|re_edit)$/i;
    const isPrepBracketWord = w => w != null && (prepBracketWords.test(w) || isLowerCaseBracketWord(w));
    const isSentenceStopChar = w => w != null && /^[:.;?!/]$/.test(w);
    const isApostrophe = w => w != null && /^['’]$/.test(w);
    const isPunctuationChar = w => w != null && /^[:.;?!,]$/.test(w);

    // ── modes.js ─────────────────────────────────────────────────────────────────────────
    const LOWER_CASE_WORDS = /^(a|an|and|as|at|but|by|da|de|di|fe|fi|for|in|ina|inna|n|nor|o|of|on|or|tha|the|to)$/;
    const LOWER_CASE_WORDS_TURKISH = /^(ve|ile|ya|veya|yahut|ki|mı|mi|mu|mü|mısın|musun|mudur|mıdır|midir|miyim|misin|misiniz|mısınız|müsün|müyüm|müsünüz|mıyım|muyum|musunuz|miyiz|mıyız|muyuz|müyüz|müdür)$/;
    const UPPER_CASE_WORDS = /^(dj|mc|tv|mtv|ep|lp|ymca|nyc|ny|ussr|usa|r&b|bbc|fm|bc|ac|dc|uk|bpm|ok|nba|rza|gza|odb|dmx|2xlc)$/;
    const ROMAN_NUMERALS = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
    const EXCLUDED_ROMAN_NUMERALS = /^(?:mi|mix)$/;   // also frequent words

    const PREPROCESS_FIXLIST = [
        [/(^|\s)([({[])\s+($|\b)/i, '$2'],            // spaces after opening brackets
        [/(\b|^)\s+([)}\]])($|\b)/i, '$2'],            // spaces before closing brackets
        [/(\s|^|\()(\d+)''(\s|$)/i, '$2"'],            // 12'' -> 12"
        [/(\s|^|\()(\d+)in(ch)?(\s|$)/i, '$2"'],       // 12in -> 12"
        // combined words, put back together in post-processing
        [/(\b|^)a\s?c+ap+el+a(\b)/ig, 'a_cappella'],
        [/(\b|^)oc\sremix(\b)/ig, 'oc_remix'],
        [/(\b|^)re-edit(\b)/ig, 're_edit'],
        [/(\b|^)a\/k\/a(\b)/ig, 'a_k_a_'],
        [/(\b|^)a\.k\.a\.(\s)/ig, 'a_k_a_'],
    ];
    const POSTPROCESS_FIXLIST = [
        [/(\b|^)a_cappella(\b)/g, 'a cappella'],
        [/(\b|^)A_cappella(\b)/g, 'A Cappella'],
        [/(\b|^)oc_remix(\b)/ig, 'OC ReMix'],
        [/(\b|^)re_edit(\b)/g, 're-edit'],
        [/(\b|^)Re_edit(\b)/g, 'Re-Edit'],
        [/(\b|^)a_k_a_(\b|$)/ig, 'a.k.a.'],
        [/(\b|^)aka(\b|$)/ig, 'aka'],
        [/(\b|^)Santa fe(\b|$)/g, 'Santa Fe'],         // "fe" is a lowercase word
        [/(\b|^)R\s*&\s*B(\b)/ig, 'R&B'],
        [/(\b|^)\[live\](\b)/i, '(live)'],
        [/(\b|^)Djs(\b)/ig, 'DJs'],
        [/(\b|^)imac(\b)/ig, 'iMac'],
        [/(\b|^)ipad(\b)/ig, 'iPad'],
        [/(\b|^)iphone(\b)/ig, 'iPhone'],
        [/(\b|^)ipod(\b)/ig, 'iPod'],
        [/(\b|^)itunes(\b)/ig, 'iTunes'],
        [/(\b|^)tiktok(\b)/ig, 'TikTok'],
        [/(\b|^)youtube(\b)/ig, 'YouTube'],
        [/(\s|^)Rock '?n'? Roll(\s|$)/ig, "Rock 'n' Roll"],
        [/(\b)w([/／])o(\b)/i, 'w$2o'],
        [/(\b)f([.．/／])(\b)/i, 'f$2'],
    ];

    function replaceMatch(matches, inputString, regex, replacement) {
        const a = matches[1] || '';
        const b = matches[matches.length - 1] || '';
        return inputString.replace(regex, [a, replacement, b].join(''));
    }

    function runFixes(inputString, fixes) {
        let output = inputString;
        fixes.forEach(([regex, replacement]) => {
            let matches;
            if (regex.global) {
                let previousOutput;
                while ((matches = regex.exec(output))) {
                    previousOutput = output;
                    output = replaceMatch(matches, output, regex, replacement);
                    if (previousOutput === output) break;
                }
            } else {
                const m = output.match(regex);
                if (m !== null) output = replaceMatch(m, output, regex, replacement);
            }
        });
        return output;
    }

    // A mode is made per run: isRomanNumber reads the run's option where MusicBrainz reads a cookie.
    function makeDefaultMode(opts) {
        return {
            doWord() { return false; },
            fixVinylSizes(s) {
                return s
                    .replace(/(\s+|\()(7|10|12)(?:inch\b|in\b|'|''|")([^s]|$)/ig, '$1$2"$3')
                    .replace(/((?:\s+|\()(?:7|10|12)")([^),\s])/, '$1 $2');
            },
            isLowerCaseWord(w) { return LOWER_CASE_WORDS.test(w); },
            isRomanNumber(w) { return !!opts.romanUpper && ROMAN_NUMERALS.test(w) && !EXCLUDED_ROMAN_NUMERALS.test(w); },
            isSentenceCaps() { return true; },
            isUpperCaseWord(w) { return UPPER_CASE_WORDS.test(w); },
            name: '',
            // My Track Extended Dub remix => My Track (extended dub remix)
            prepExtraTitleInfo(words) {
                let outputWords = words;
                const lastWord = outputWords.length - 1;
                let wordIndex = lastWord;
                let handlePreProcess = false;
                while (wordIndex >= 0 && (
                    (outputWords[wordIndex] === ' ') ||
                    (outputWords[wordIndex] === '"' && (outputWords[wordIndex - 1] === '7' || outputWords[wordIndex - 1] === '12')) ||
                    ((outputWords[wordIndex + 1] || '') === '"' && (outputWords[wordIndex] === '7' || outputWords[wordIndex] === '12')) ||
                    isPrepBracketWord(outputWords[wordIndex])
                )) {
                    handlePreProcess = true;
                    wordIndex--;
                }
                if (wordIndex < lastWord) {
                    wordIndex++;
                    while (outputWords[wordIndex] === ' ' && wordIndex < lastWord) wordIndex++;
                    const probe = outputWords[lastWord];
                    if (wordIndex === lastWord && isPrepBracketSingleWord(probe)) handlePreProcess = false;
                    if (handlePreProcess && wordIndex > 0 && wordIndex <= lastWord) {
                        let newWords = outputWords.slice(0, wordIndex);
                        if (newWords[wordIndex - 1] === '(') newWords.pop();
                        if (newWords[wordIndex - 1] === '-') newWords.pop();
                        newWords.push('(');
                        newWords = newWords.concat(outputWords.slice(wordIndex, outputWords.length));
                        newWords.push(')');
                        outputWords = newWords;
                    }
                }
                return outputWords;
            },
            preProcessTitles(s) { return runFixes(s, PREPROCESS_FIXLIST); },
            runPostProcess(s) { return runFixes(s, POSTPROCESS_FIXLIST); },
            toLowerCase(s) { return s.toLowerCase(); },
            toUpperCase(s) { return s.toUpperCase(); },
        };
    }

    const MODES = {
        English(D) {
            return { ...D, name: 'English', isSentenceCaps() { return false; },
                runPostProcess(s) {
                    // keys as the English classical guidelines write them
                    return D.runPostProcess(s).replace(
                        /\bin ([a-g])(?:[\s-]([Ff]lat|[Ss]harp))?\s(dorian|lydian|major|minor|mixolydian)(?:\b|$)/ig,
                        (m, p1, p2, p3) => 'in ' + p1.toUpperCase() + (p2 ? '-' + p2.toLowerCase() : '') + ' ' + p3.toLowerCase());
                } };
        },
        French(D) {
            return { ...D, name: 'French',
                runPostProcess(s) {
                    return D.runPostProcess(s)
                        .replace(/([!?;:]+)/gi, ' $1')
                        .replace(/([«]+)/gi, '$1 ')
                        .replace(/([»]+)/gi, ' $1')
                        .replace(/^(Le\s|La\s|Les\s|L[’'])(\S+)$/gi, (_, m1, m2) => m1.replace('\'', '’') + capitalize(m2));
                } };
        },
        Sentence(D) { return { ...D, name: 'Sentence' }; },
        // Ours: sentence case under the language's name. Their own lowercase words would change
        // nothing: sentence case lowercases every word but the forced ones, and a forced word
        // skips the lowercase list.
        Spanish(D) { return { ...D, name: 'Spanish' }; },
        Italian(D) { return { ...D, name: 'Italian' }; },
        Portuguese(D) { return { ...D, name: 'Portuguese' }; },
        // Dutch capitalises the IJ digraph as one letter: IJsland, IJzer
        Dutch(D) { return { ...D, name: 'Dutch', runPostProcess(s) { return D.runPostProcess(s).replace(/(^|[^\p{L}\p{N}])Ij/gu, '$1IJ'); } }; },
        Turkish(D) {
            return { ...D, name: 'Turkish', isSentenceCaps() { return false; },
                isLowerCaseWord(w) { return LOWER_CASE_WORDS.test(w) || LOWER_CASE_WORDS_TURKISH.test(w); },
                toLowerCase(w) { return w.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase(); },
                toUpperCase(w) { return w.replace(/i/g, 'İ').toUpperCase(); } };
        },
    };

    // ── utils/titleString.js ─────────────────────────────────────────────────────────────
    function titleString(input, output, inputString, mode, keepUpper, forceCaps) {
        if (empty(inputString)) return '';
        const flags = input.flags;
        const localForceCaps = forceCaps == null ? flags.context.forceCaps : forceCaps;
        const len = input.getLength();
        let pos = input.getCursorPosition();
        // past the last word: the run is done, we're looking at the last word again
        if (pos === len) { pos = len - 1; input.setCursorPosition(pos); }

        let outputString;
        let lowercase = mode.toLowerCase(inputString);
        let uppercase = mode.toUpperCase(inputString);

        if (inputString === uppercase && inputString.length > 1 && keepUpper) {
            outputString = uppercase;
        } else if (lowercase.length === 1 && isApostrophe(input.getPreviousWord())) {
            outputString = lowercase;                  // 'x
        } else if (mode.name === 'English' && isApostrophe(input.getPreviousWord()) && lowercase.match(/^(?:all|ve|ll|cha|re|mon)$/i)) {
            outputString = lowercase;                  // Y'all, They've, You'll, What'cha, You're, C'mon
        } else if (mode.name === 'English' && isApostrophe(input.getPreviousWord()) && input.getWordAtIndex(pos - 2) === 'Ev') {
            outputString = lowercase;                  // Ev'ry
        } else if (mode.name === 'English' && lowercase.match(/^[coy]$/i) && isApostrophe(input.getNextWord())) {
            outputString = uppercase;                  // O'Titled, Y'All, C'mon
        } else {
            outputString = titleStringByMode(input, output, mode, lowercase, localForceCaps);
            lowercase = mode.toLowerCase(outputString);
            uppercase = mode.toUpperCase(outputString);
            const nextWord = input.getNextWord();
            const followedByPunctuation = nonEmpty(nextWord) && nextWord.length === 1 && isPunctuationChar(nextWord);
            const followedByApostrophe = nonEmpty(nextWord) && nextWord.length === 1 && isApostrophe(nextWord);
            if (!localForceCaps && mode.isLowerCaseWord(lowercase) && !followedByPunctuation) {
                outputString = lowercase;
            } else if (mode.isRomanNumber(lowercase) && !followedByApostrophe && !(flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase))) {
                outputString = uppercase;
            } else if (mode.isUpperCaseWord(lowercase)) {
                outputString = uppercase;
            } else if (flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase)) {
                outputString = lowercase;
            }
        }
        return outputString;
    }

    function titleStringByMode(input, output, mode, inputString, forceCaps) {
        if (empty(inputString)) return '';
        const flags = input.flags;
        let outputString = mode.toLowerCase(inputString);
        const opos = output.getLength();
        let wordBefore = '';
        if (opos > 1) wordBefore = output.getWordAtIndex(opos - 2);
        const doCaps = forceCaps || !mode.isSentenceCaps() ||
            flags.context.slurpExtraTitleInformation || flags.context.openingBracket ||
            input.isFirstWord() || isSentenceStopChar(wordBefore);
        if (doCaps) {
            const chars = outputString.split('');
            chars[0] = mode.toUpperCase(chars[0]);
            if (inputString.length > 2 && inputString.substring(0, 2) === 'mc') chars[2] = mode.toUpperCase(chars[2]);   // McTitled
            outputString = chars.join('');
        }
        return outputString;
    }

    // ── MB/GuessCase/Input.js ────────────────────────────────────────────────────────────
    class Input {
        constructor(inputString, mode, keepUpper, regexes, flags) {
            this.keepUpper = keepUpper; this.mode = mode; this.regexes = regexes; this.flags = flags;
            this.source = inputString || ''; this.wordList = []; this.wordIndex = 0;
        }
        init(wordlist, output) { this.output = output; this.wordList = wordlist || []; }
        getLength() { return this.wordList.length; }
        isEmpty() { return this.getLength() === 0; }
        getCursorPosition() { return this.wordIndex; }
        setCursorPosition(i) { if (i >= 0 && i < this.getLength()) this.wordIndex = i; }
        getWordAtIndex(i) { return this.wordList[i] || null; }
        getNextWord() { return this.getWordAtIndex(this.wordIndex + 1); }
        getCurrentWord() { return this.getWordAtIndex(this.wordIndex); }
        getPreviousWord() { return this.getWordAtIndex(this.wordIndex - 1); }
        isFirstWord() { return this.wordIndex === 0; }
        isLastWord() { return this.getLength() === this.wordIndex - 1; }
        isNextWord(w) { return this.hasMoreWords() && this.getNextWord() === w; }
        isPreviousWord(w) { return !this.isFirstWord() && this.getPreviousWord() === w; }
        matchCurrentWord(re) { return this.matchWordAtIndex(this.getCursorPosition(), re); }
        matchWordAtIndex(i, re) {
            const word = this.getWordAtIndex(i) || '';
            return typeof re === 'string' ? re === word : word.match(re) != null;
        }
        hasMoreWords() { return (this.wordIndex === 0 && this.getLength() > 0) || (this.wordIndex - 1 < this.getLength()); }
        isIndexAtEnd() { return this.wordIndex === this.getLength(); }
        nextIndex() { this.wordIndex++; }
        dropLastWord() {
            if (this.getLength() > 0) { this.wordList.pop(); if (this.isIndexAtEnd()) this.wordIndex--; }
        }
        insertWordsAtIndex(i, newWords) {
            this.wordList = this.wordList.slice(0, i).concat(newWords).concat(this.wordList.slice(i));
        }
        capitalizeCurrentWord() {
            const word = this.getCurrentWord();
            if (word == null) return null;
            const out = titleString(this, this.output, word, this.mode, this.keepUpper);
            if (word !== out) this.updateCurrentWord(out);
            return out;
        }
        updateCurrentWord(w) { if (this.wordIndex < this.wordList.length) this.wordList[this.wordIndex] = w; }
        // words, punctuation and spaces of the input
        splitWordsAndPunctuation(inputString) {
            const input = inputString.replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(/\s\s*/g, ' ');
            const chars = input.split('');
            const splitwords = [];
            let word = [];
            if (!this.regexes.SPLITWORDSANDPUNCTUATION) this.regexes.SPLITWORDSANDPUNCTUATION = /[^!¿¡"%&'´`‘’‹›“”„“«»()[\]{}*+‐\-,./:;<=>?\s#]/;
            for (let i = 0; i < chars.length; i++) {
                if (chars[i].match(this.regexes.SPLITWORDSANDPUNCTUATION)) {
                    word.push(chars[i]);
                } else {
                    if (word.length > 0) splitwords.push(word.join(''));
                    splitwords.push(chars[i]);
                    word = [];
                }
            }
            if (word.length > 0) splitwords.push(word.join(''));
            return splitwords;
        }
    }

    // ── MB/GuessCase/Output.js ───────────────────────────────────────────────────────────
    class Output {
        constructor(input, mode, keepUpper, flags) {
            this.keepUpper = keepUpper; this.mode = mode; this.input = input; this.flags = flags; this.wordList = [];
        }
        getLength() { return this.wordList.length; }
        isEmpty() { return this.getLength() === 0; }
        appendCurrentWord() { const w = this.input.getCurrentWord(); if (w != null) this.appendWord(w); }
        appendWord(w) { if (w === ' ') this.appendSpace(); else if (w !== '' && w != null) this.wordList.push(w); }
        appendSpace() { this.wordList.push(' '); }
        appendSpaceIfNeeded() { if (this.flags.context.spaceNextWord) this.appendSpace(); }
        getWordAtIndex(i) { return this.wordList[i] ? this.wordList[i] : null; }
        setWordAtIndex(i, w) { if (this.getWordAtIndex(i)) this.wordList[i] = w; }
        getLastWord() { return this.isEmpty() ? null : this.wordList[this.wordList.length - 1]; }
        capitalizeWordAtIndex(index, overrideCaps) {
            const flags = this.flags;
            const forceCaps = overrideCaps == null ? flags.context.forceCaps : overrideCaps;
            if ((!this.mode.isSentenceCaps() || forceCaps) && !this.isEmpty()) {
                const word = this.getWordAtIndex(index);
                if (word != null) {
                    let output = word;
                    if (word.match(/^\w\..*/) == null) {           // not an acronym
                        const probe = trim(word.toLowerCase());
                        if (!forceCaps && flags.isInsideBrackets() && isLowerCaseBracketWord(probe)) {
                            // inside brackets: leave it
                        } else if (!forceCaps && this.mode.isUpperCaseWord(probe)) {
                            // an UPPERCASE word: leave it
                        } else {
                            const originalPosition = this.input.getCursorPosition();
                            let position = originalPosition - 1;
                            while (position >= 0) {
                                const w = this.input.getWordAtIndex(position);
                                if (w == null || trim(w.toLowerCase()) === probe) break;
                                position--;
                            }
                            this.input.setCursorPosition(position);
                            output = titleString(this.input, this, word, this.mode, this.keepUpper, forceCaps);
                            this.input.setCursorPosition(originalPosition);
                            if (word !== output) this.setWordAtIndex(index, output);
                        }
                    }
                }
            }
        }
        capitalizeLastWord(overrideCaps) { this.capitalizeWordAtIndex(this.getLength() - 1, overrideCaps); }
        getOutput() {
            this.flags.context.forceCaps = !this.mode.isSentenceCaps();   // not sentence mode: caps on the last word
            this.capitalizeLastWord();
            this.closeOpenBrackets();
            return trim(this.wordList.join(''));
        }
        closeOpenBrackets() {
            const parts = [];
            while (this.flags.isInsideBrackets()) parts[parts.length] = this.flags.popBracket();
            this.appendWord(parts.join(''));
        }
        appendWordPreserveWhiteSpace(capitalizeLast) {
            const ws = { after: this.input.isNextWord(' '), before: this.input.isPreviousWord(' ') };
            if (capitalizeLast) this.capitalizeLastWord(!this.mode.isSentenceCaps());
            if (ws.before) this.appendSpace();
            this.appendCurrentWord();
            this.flags.context.spaceNextWord = ws.after;
        }
    }

    // ── MB/GuessCase/Handler/Base.js ─────────────────────────────────────────────────────
    const SPECIAL = {
        NOT_A_SPECIALCASE: -1, SPECIALCASE_CROWD_NOISE: 33, SPECIALCASE_DATA_TRACK: 30, SPECIALCASE_DIALOGUE: 35,
        SPECIALCASE_GUITAR_SOLO: 34, SPECIALCASE_SILENCE: 31, SPECIALCASE_UNKNOWN: 10, SPECIALCASE_UNTITLED: 32,
    };

    class Handler {
        constructor(mode, regexes, input, output, flags) {
            this.mode = mode; this.regexes = regexes; this.input = input; this.output = output; this.flags = flags;
            this.specialCaseValues = SPECIAL;
        }
        checkSpecialCase() { return SPECIAL.NOT_A_SPECIALCASE; }
        isSpecialCase(n) { return n !== SPECIAL.NOT_A_SPECIALCASE; }
        getSpecialCaseFormatted(inputString, n) {
            switch (n) {
                case SPECIAL.SPECIALCASE_DATA_TRACK: return '[data track]';
                case SPECIAL.SPECIALCASE_SILENCE: return '[silence]';
                case SPECIAL.SPECIALCASE_UNTITLED: return '[untitled]';
                case SPECIAL.SPECIALCASE_UNKNOWN: return '[unknown]';
                case SPECIAL.SPECIALCASE_CROWD_NOISE: return '[crowd noise]';
                case SPECIAL.SPECIALCASE_GUITAR_SOLO: return '[guitar solo]';
                case SPECIAL.SPECIALCASE_DIALOGUE: return '[dialogue]';
                default: return inputString;
            }
        }
        getWordsForProcessing(s) { return this.input.splitWordsAndPunctuation(s); }
        process(s) {
            this.input.init(this.getWordsForProcessing(s), this.output);
            while (!this.input.isIndexAtEnd()) this.processWord();
            return this.mode.runPostProcess(this.output.getOutput());
        }
        processWord() {
            if (!this.doWhiteSpace()) {
                let handled = false;
                if (!this.regexes.SPECIALCASES) this.regexes.SPECIALCASES = /(&|¿|¡|\?|!|;|:|'|‘|’|‹|›|"|“|”|„|“|«|»|-|‐|\+|,|\*|\.|#|%|\/|\(|\)|\{|\}|\[|\])/;
                if (this.input.matchCurrentWord(this.regexes.SPECIALCASES)) {
                    handled = this.doDoubleQuote() || this.doSingleQuote() || this.doOpeningBracket() ||
                        this.doClosingBracket() || this.doComma() || this.doPeriod() || this.doLineStop() ||
                        this.doAmpersand() || this.doSlash() || this.doColon() || this.doHyphen() ||
                        this.doInvertedMarks() || this.doPlus() || this.doAsterisk() || this.doDiamond() || this.doPercent();
                }
                handled || this.doDigits() || this.doAcronym() || this.doWord();
            }
            this.input.nextIndex();
        }
        doWord() { return true; }
        doNormalWord() {
            const c = this.flags.context;
            this.output.appendSpaceIfNeeded();
            this.input.capitalizeCurrentWord();
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.forceCaps = false;
            c.spaceNextWord = true;
        }
        doWhiteSpace() {
            if (!this.regexes.WHITESPACE) this.regexes.WHITESPACE = /^ $/;
            if (this.input.matchCurrentWord(this.regexes.WHITESPACE)) {
                const c = this.flags.context;
                c.whitespace = true;
                c.spaceNextWord = true;
                if (c.openingBracket) c.spaceNextWord = false;
                return true;
            }
            return false;
        }
        // a sub-title split, also disc/box name splits
        doColon() {
            if (!this.regexes.COLON) this.regexes.COLON = /^:$/;
            if (this.input.matchCurrentWord(this.regexes.COLON)) {
                const c = this.flags.context;
                const featIndex = this.output.getLength() - 3;
                const role = this.output.getLastWord();
                if (c.slurpExtraTitleInformation && featIndex > 0 && this.output.getWordAtIndex(featIndex) === 'feat.' && nonEmpty(role)) {
                    this.output.setWordAtIndex(this.output.getLength() - 1, role.toLowerCase());
                } else {
                    this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                }
                let skip = false;
                const cursorPosition = this.input.getCursorPosition();
                const length = this.input.getLength();
                if (cursorPosition < length - 2) {
                    const nextWord = this.input.getWordAtIndex(cursorPosition + 1);
                    const afterNextWord = this.input.getWordAtIndex(cursorPosition + 2);
                    // OPENBRACKET is set: doOpeningBracket ran before doColon for this word
                    if (nextWord != null && nextWord.match(this.regexes.OPENBRACKET)) { skip = true; c.spaceNextWord = true; }
                    if (this.input.isNextWord(' ') && afterNextWord != null && afterNextWord.match(this.regexes.OPENBRACKET)) {
                        c.spaceNextWord = true;
                        skip = true;
                        this.input.nextIndex();
                    }
                }
                if (!skip) {
                    this.output.appendCurrentWord();
                    this.flags.resetContext();
                    c.forceCaps = true;
                    c.colon = true;
                    c.spaceNextWord = this.input.isNextWord(' ');
                }
                return true;
            }
            return false;
        }
        doPreserving(name, re) {
            if (!this.regexes[name]) this.regexes[name] = re;
            if (this.input.matchCurrentWord(this.regexes[name])) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                return true;
            }
            return false;
        }
        doAsterisk() { return this.doPreserving('ASTERISK', /^\*$/); }
        doDiamond() { return this.doPreserving('DIAMOND', /^#$/); }
        doPercent() { return this.doPreserving('PERCENT', /^%$/); }
        doPlus() { return this.doPreserving('PLUS', /^\+$/); }
        doAmpersand() {
            if (!this.regexes.AMPERSAND) this.regexes.AMPERSAND = /^&$/;
            if (this.input.matchCurrentWord(this.regexes.AMPERSAND)) {
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                this.output.appendSpace();
                this.flags.context.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // ? ! ;
        doLineStop() {
            if (!this.regexes.LINESTOP) this.regexes.LINESTOP = /[?!;]/;
            if (this.input.matchCurrentWord(this.regexes.LINESTOP)) {
                this.flags.resetContext();
                this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                this.flags.context.forceCaps = true;
                this.flags.context.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // a spaced hyphen is a pause, an unspaced one part of a word
        doHyphen() {
            if (!this.regexes.HYPHEN) this.regexes.HYPHEN = /^[-‐]$/;
            if (this.input.matchCurrentWord(this.regexes.HYPHEN)) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                this.flags.context.forceCaps = !this.mode.isSentenceCaps();
                this.flags.context.hyphen = true;
                return true;
            }
            return false;
        }
        doInvertedMarks() {
            if (!this.regexes.INVERTEDMARKS) this.regexes.INVERTEDMARKS = /(¿|¡)/;
            if (this.input.matchCurrentWord(this.regexes.INVERTEDMARKS)) {
                this.output.appendWordPreserveWhiteSpace(false);
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                return true;
            }
            return false;
        }
        doSlash() {
            if (!this.regexes.SLASH) this.regexes.SLASH = /[\\/]/;
            if (this.input.matchCurrentWord(this.regexes.SLASH)) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                return true;
            }
            return false;
        }
        doDoubleQuote() {
            if (!this.regexes.DOUBLEQUOTE) this.regexes.DOUBLEQUOTE = /["“”„“«»]/;
            if (this.input.matchCurrentWord(this.regexes.DOUBLEQUOTE)) {
                this.output.appendWordPreserveWhiteSpace(false);
                this.flags.resetContext();
                this.flags.context.forceCaps = !this.input.isNextWord(' ');
                return true;
            }
            return false;
        }
        doSingleQuote() {
            if (!this.regexes.SINGLEQUOTE) this.regexes.SINGLEQUOTE = /['‘’‹›]/;
            if (this.input.matchCurrentWord(this.regexes.SINGLEQUOTE)) {
                const c = this.flags.context;
                c.forceCaps = false;
                const isPreviousSpace = this.input.isPreviousWord(' ');
                const isNextSpace = this.input.isNextWord(' ');
                const state = c.openedSingleQuote;
                if (isPreviousSpace && !isNextSpace) {             // "Asdf 'Text in Quotes'"
                    this.output.appendSpace();
                    c.openedSingleQuote = true;
                    c.forceCaps = true;
                } else if (!isPreviousSpace && isNextSpace) {      // closing
                    if (state) { c.forceCaps = true; c.openedSingleQuote = false; }
                    this.output.capitalizeLastWord();
                }
                c.spaceNextWord = isNextSpace;
                this.output.appendCurrentWord();
                this.flags.resetContext();
                if (state === c.openedSingleQuote) c.forceCaps = false;   // "Rollin' on"
                c.singlequote = true;
                return true;
            }
            return false;
        }
        doOpeningBracket() {
            if (!this.regexes.OPENBRACKET) this.regexes.OPENBRACKET = /[([{<]/;
            const currentWord = this.input.getCurrentWord();
            if (currentWord != null && currentWord.match(this.regexes.OPENBRACKET)) {
                const c = this.flags.context;
                this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                this.flags.pushBracket(currentWord);
                const closingBracket = this.flags.getCurrentCloseBracket();
                let forcelowercase = false;
                const cursorPosition = this.input.getCursorPosition() + 1;
                for (let i = cursorPosition; i < this.input.getLength(); i++) {
                    const word = this.input.getWordAtIndex(i) || '';
                    if (word !== ' ') {
                        if (isLowerCaseBracketWord(word) || word.match(/^featuring$|^ft$|^feat$/i) != null) {
                            c.slurpExtraTitleInformation = true;
                            if (i === cursorPosition) forcelowercase = true;
                        }
                        if (word === closingBracket) break;
                    }
                }
                this.output.appendSpace();
                this.flags.resetContext();
                c.spaceNextWord = false;
                c.openingBracket = true;
                c.forceCaps = !forcelowercase;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        doClosingBracket() {
            if (!this.regexes.CLOSEBRACKET) this.regexes.CLOSEBRACKET = /[)\]}>]/;
            if (this.input.matchCurrentWord(this.regexes.CLOSEBRACKET)) {
                const c = this.flags.context;
                this.output.capitalizeLastWord();
                if (this.flags.isInsideBrackets()) { this.flags.popBracket(); c.slurpExtraTitleInformation = false; }
                this.flags.resetContext();
                c.forceCaps = !this.mode.isSentenceCaps();
                c.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        doComma() {
            if (!this.regexes.COMMA) this.regexes.COMMA = /^,$/;
            if (this.input.matchCurrentWord(this.regexes.COMMA)) {
                if (this.output.getLastWord() !== ',') {           // skip duplicate commas
                    this.flags.resetContext();
                    this.flags.context.spaceNextWord = true;
                    this.flags.context.forceCaps = false;
                    this.output.appendCurrentWord();
                }
                return true;
            }
            return false;
        }
        // a full stop, a number split, an ellipsis or an acronym
        doPeriod() {
            if (!this.regexes.PERIOD) this.regexes.PERIOD = /^\.$/;
            if (this.input.matchCurrentWord(this.regexes.PERIOD)) {
                const c = this.flags.context;
                if (this.output.getLastWord() === '.') {
                    if (!c.ellipsis) {
                        this.output.appendWord('..');
                        while (this.input.isNextWord('.')) this.input.nextIndex();
                        this.flags.resetContext();
                        c.ellipsis = true;
                    }
                    c.forceCaps = true;
                    c.spaceNextWord = true;
                } else {
                    if (!this.input.hasMoreWords() || this.input.getNextWord() !== '.') this.output.capitalizeLastWord();
                    this.output.appendWord('.');
                    this.flags.resetContext();
                    c.forceCaps = true;
                    c.spaceNextWord = this.input.isNextWord(' ');
                }
                return true;
            }
            return false;
        }
        // "A. B. C. I Love You" => "A.B.C. I Love You"
        doAcronym() {
            if (!this.regexes.ACRONYM) this.regexes.ACRONYM = /^\w$/;
            let subIndex = this.input.getCursorPosition() + 1;
            const tmp = [];
            const currentWord = this.input.getCurrentWord();
            if (currentWord != null && currentWord.match(this.regexes.ACRONYM)) {
                tmp.push(currentWord.toUpperCase());
                let expectWord = false;
                let gotPeriod = false;
                for (; subIndex < this.input.getLength();) {
                    const wordAtIndex = this.input.getWordAtIndex(subIndex);
                    if (expectWord && wordAtIndex != null && wordAtIndex.match(this.regexes.ACRONYM)) {
                        tmp.push(wordAtIndex.toUpperCase());
                        expectWord = false;
                        gotPeriod = false;
                    } else {
                        if (wordAtIndex === '.' && !gotPeriod) {
                            tmp[tmp.length] = '.';
                            gotPeriod = true;
                            expectWord = true;
                        } else if (gotPeriod && wordAtIndex === ' ') {
                            expectWord = true;
                        } else if (tmp[tmp.length - 1] !== '.') {
                            tmp.pop();
                            subIndex--;
                        }
                        break;
                    }
                    subIndex++;
                }
            }
            if (tmp.length > 2) {
                const string = tmp.join('').replace(/(\.)*$/, '.');
                const c = this.flags.context;
                this.output.appendSpaceIfNeeded();
                this.output.appendWord(string);
                this.flags.resetContext();
                c.acronym = true;
                c.spaceNextWord = true;
                c.forceCaps = false;
                this.input.setCursorPosition(subIndex - 1);
                return true;
            }
            return false;
        }
        doDigits() {
            if (!this.regexes.DIGITS) {
                this.regexes.DIGITS = /^\d+$/;
                this.regexes.DIGITS_NUMBERSPLIT = /[,.]/;
                this.regexes.DIGITS_DUPLE = /^\d\d$/;
                this.regexes.DIGITS_TRIPLE = /^\d\d\d$/;
                this.regexes.DIGITS_NTUPLE = /^\d\d\d\d+$/;
            }
            const c = this.flags.context;
            let subIndex = this.input.getCursorPosition() + 1;
            const tmp = [];
            if (this.input.matchCurrentWord(this.regexes.DIGITS)) {
                tmp.push(this.input.getCurrentWord());
                c.numberSplitExpect = true;
                for (; subIndex < this.input.getLength();) {
                    if (c.numberSplitExpect) {
                        if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NUMBERSPLIT)) {
                            tmp.push(this.input.getWordAtIndex(subIndex));
                            c.numberSplitExpect = false;
                        } else {
                            break;
                        }
                    } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_TRIPLE)) {
                        if (c.numberSplitChar == null) c.numberSplitChar = tmp[tmp.length - 1];
                        tmp.push(this.input.getWordAtIndex(subIndex));
                        c.numberSplitExpect = true;
                    } else {
                        if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_DUPLE)) {
                            if (tmp.length > 2 && c.numberSplitChar !== tmp[tmp.length - 1]) {
                                tmp.push(this.input.getWordAtIndex(subIndex++));   // 1,000,936.00 or 1.300.402,00
                            } else {
                                tmp.pop();
                                subIndex--;
                            }
                        } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NTUPLE)) {
                            tmp.push(this.input.getWordAtIndex(subIndex++));
                        } else {
                            tmp.pop();
                            subIndex--;
                        }
                        break;
                    }
                    subIndex++;
                }
                this.input.setCursorPosition(subIndex - 1);
                this.output.appendSpaceIfNeeded();
                this.output.appendWord(tmp.join(''));
                this.flags.resetContext();
                c.forceCaps = false;
                c.number = true;
                return true;
            }
            return false;
        }
        doIgnoreWords() {
            if (this.input.getCurrentWord() === 'dB') {        // deciBel
                this.output.appendSpaceIfNeeded();
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // featuring, f., ft[.], feat[.] → (feat. …)
        doFeaturingArtistStyle() {
            if (!this.regexes.FEAT) {
                this.regexes.FEAT = /^featuring$|^f$|^ft$|^feat$/i;
                this.regexes.FEAT_F = /^f$/i;
                this.regexes.FEAT_FEAT = /^feat$/i;
            }
            const flags = this.flags, c = flags.context;
            const currentWord = this.input.getCurrentWord();
            if (currentWord == null) return false;
            if (currentWord.match(this.regexes.FEAT)) {
                const nextWord = this.input.getNextWord();
                if (currentWord.match(this.regexes.FEAT_F) && nextWord != null && !nextWord.match(/^[/.]$/)) return false;
                if (this.input.getCursorPosition() < this.input.getLength() - 2) {
                    const nw = this.input.getNextWord();
                    const featWord = currentWord + (nw != null && (nw === '.' || nw === '/')
                        ? nw
                        : currentWord.match(this.regexes.FEAT_FEAT) ? '.' : '');
                    if (!c.openingBracket && !flags.isInsideBrackets()) {
                        if (flags.isInsideBrackets()) {
                            while (flags.isInsideBrackets()) {
                                const cb = flags.popBracket();
                                this.output.appendWord(cb);
                                if (this.input.getWordAtIndex(this.input.getLength() - 1) === cb) this.input.dropLastWord();
                            }
                        }
                        // "Blah ft. Erroll Flynn Some Remixname (remix)" → "Blah (feat. Erroll Flynn Some Remixname) (remix)"
                        const cursorPosition = this.input.getCursorPosition();
                        const length = this.input.getLength();
                        let i = cursorPosition;
                        for (; i < length; i++) if (this.input.getWordAtIndex(i) === '(') break;
                        if (i !== cursorPosition && i < length - 1) this.input.insertWordsAtIndex(i, [')', ' ']);
                        this.input.updateCurrentWord('(');
                        this.doOpeningBracket();
                    } else {
                        this.output.appendWord(' ');
                    }
                    this.output.appendWord(featWord);
                    flags.resetContext();
                    c.forceCaps = true;
                    c.openingBracket = false;
                    c.spaceNextWord = true;
                    c.slurpExtraTitleInformation = true;
                    if (this.input.isNextWord('.') || this.input.isNextWord('/')) this.input.nextIndex();
                    return true;
                }
            }
            return false;
        }
        moveArticleToEnd(s) { return trim(s).replace(/^(The|Los) (.+)$/, (m, article, name) => name + ', ' + article); }
        sortCompoundName(s, callback) {
            const t = trim(s);
            let joinPhrase = ' and ';
            joinPhrase = t.indexOf(' + ') === -1 ? joinPhrase : ' + ';
            joinPhrase = t.indexOf(' & ') === -1 ? joinPhrase : ' & ';
            return t.split(joinPhrase).map(x => callback(x, this.regexes)).join(joinPhrase);
        }
        // the word handling the track, release, work and area handlers share
        doTitleWord(ignoreWords, featuring) {
            (ignoreWords && this.doIgnoreWords()) ||
                (featuring && this.doFeaturingArtistStyle()) ||
                this.mode.doWord() ||
                this.doNormalWord();
            this.flags.context.number = false;
            return true;
        }
        doNameWord() {
            const c = this.flags.context;
            this.output.appendSpaceIfNeeded();
            this.input.capitalizeCurrentWord();
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.number = false;
            c.forceCaps = false;
            c.spaceNextWord = true;
            return true;
        }
    }

    // ── MB/GuessCase/Handler/*.js ────────────────────────────────────────────────────────
    const UNTITLED = /^([([]?\s*untitled\s*[)\]]?)$/i;

    class TrackHandler extends Handler {
        removeBonusInfo(s) {
            return s.replace(/[([]?bonus(\s+track)?s?\s*[)\]]?$/i, '').replace(/[([]?retail(\s+version)?\s*[)\]]?$/i, '');
        }
        process(s) { return this.mode.fixVinylSizes(super.process(s)); }
        getWordsForProcessing(s) {
            return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(this.removeBonusInfo(s))));
        }
        checkSpecialCase(s) {
            if (s != null) {
                if (/^([([]?\s*data(\s+track)?\s*[)\]]?$)/i.test(s)) return SPECIAL.SPECIALCASE_DATA_TRACK;
                if (/^([([]?\s*(silen(t|ce)|blank)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_SILENCE;
                if (/^([([]?\s*untitled(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_UNTITLED;
                if (/^([([]?\s*(unknown|bonus|hidden)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_UNKNOWN;
                if (/^\?+$/i.test(s)) return SPECIAL.SPECIALCASE_UNKNOWN;
            }
            return SPECIAL.NOT_A_SPECIALCASE;
        }
        doWord() {
            const c = this.flags.context;
            if (!this.doIgnoreWords() && !this.doFeaturingArtistStyle() && !this.mode.doWord()) {
                if (this.input.matchCurrentWord(/7in/i)) {
                    this.output.appendSpaceIfNeeded();
                    this.output.appendWord('7"');
                    this.flags.resetContext();
                    c.spaceNextWord = false;
                    c.forceCaps = false;
                } else if (this.input.matchCurrentWord(/12in/i)) {
                    this.output.appendSpaceIfNeeded();
                    this.output.appendWord('12"');
                    this.flags.resetContext();
                    c.spaceNextWord = false;
                    c.forceCaps = false;
                } else {
                    this.output.appendSpaceIfNeeded();
                    this.input.capitalizeCurrentWord();
                    this.output.appendCurrentWord();
                    this.flags.resetContext();
                    c.spaceNextWord = true;
                    c.forceCaps = false;
                }
            }
            c.number = false;
            return true;
        }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    class ReleaseHandler extends Handler {
        checkSpecialCase(s) { return s != null && UNTITLED.test(s) ? SPECIAL.SPECIALCASE_UNTITLED : SPECIAL.NOT_A_SPECIALCASE; }
        process(s) { return this.mode.fixVinylSizes(super.process(s)); }
        getWordsForProcessing(s) { return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s))); }
        doWord() { return this.doTitleWord(false, true); }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    class WorkHandler extends Handler {
        checkSpecialCase(s) { return s != null && UNTITLED.test(s) ? SPECIAL.SPECIALCASE_UNTITLED : SPECIAL.NOT_A_SPECIALCASE; }
        getWordsForProcessing(s) { return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s))); }
        doWord() { return this.doTitleWord(true, true); }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    // unknown, none, no artist / no label, not applicable, n/a → [unknown]
    function noneCase(s, what) {
        if (s == null) return SPECIAL.NOT_A_SPECIALCASE;
        const res = [/^\s*$/i, /^[([]?\s*Unknown\s*[)\]]?$/i, /^[([]?\s*none\s*[)\]]?$/i,
            new RegExp('^[([]?\\s*no[\\s-]+' + what + '\\s*[)\\]]?$', 'i'),
            /^[([]?\s*not[\s-]+applicable\s*[)\]]?$/i, /^[([]?\s*n\s*[\\/]\s*a\s*[)\]]?$/i];
        return res.some(re => re.test(s)) ? SPECIAL.SPECIALCASE_UNKNOWN : SPECIAL.NOT_A_SPECIALCASE;
    }

    class ArtistHandler extends Handler {
        checkSpecialCase(s) { return noneCase(s, 'artist'); }
        doWord() { return this.doNameWord(); }
        guessSortName(s, isPerson) {
            return this.sortCompoundName(s, artistName => {
                if (!artistName) return '';
                let name = trim(artistName);
                let append = '';
                if (/,\s*Sr\.?$/i.test(name)) { name = name.replace(/,\s*Sr\.?$/i, ''); append = ', Sr.'; }
                else if (/,\s*Jr\.?$/i.test(name)) { name = name.replace(/,\s*Jr\.?$/i, ''); append = ', Jr.'; }
                let names = name.split(' ');
                let reorder = false;
                const firstName = names[0];
                if (/^DJ$/i.test(firstName)) { append = ', DJ' + append; names.shift(); }
                else if (/^The$/i.test(firstName)) { append = ', The' + append; names.shift(); }
                else if (/^Los$/i.test(firstName)) { append = ', Los' + append; names.shift(); }
                else if (/^Dr\.$/i.test(firstName)) { append = ', Dr.' + append; names.shift(); reorder = true; }
                else reorder = true;
                if (!isPerson) reorder = false;       // only persons are reordered
                if (reorder) {
                    const reordered = [];
                    if (names.length > 1) {
                        for (let i = 0; i < names.length - 1; i++) {
                            if (i === names.length - 2 && names[i] === 'St.') names[i + 1] = names[i] + ' ' + names[i + 1];   // St. belongs to the last name
                            else if (names[i]) reordered[i + 1] = names[i];
                        }
                        reordered[0] = names[names.length - 1];
                        if (reordered.length > 1) reordered[0] += ',';
                        names = reordered;
                    }
                }
                return trim(names.filter(Boolean).join(' ') + (append || ''));
            });
        }
    }

    class LabelHandler extends Handler {
        checkSpecialCase(s) { return noneCase(s, 'label'); }
        doWord() { return this.doNameWord(); }
        guessSortName(s) { return this.sortCompoundName(s, x => this.moveArticleToEnd(x)); }
    }

    class AreaHandler extends Handler {
        doWord() { return this.doTitleWord(true, true); }
        guessSortName(s) { return trim(s); }
    }

    class PlaceHandler extends Handler {
        doWord() { return this.doTitleWord(true, false); }
        guessSortName(s) { return this.sortCompoundName(s, x => this.moveArticleToEnd(x)); }
    }

    const HANDLERS = {
        area: AreaHandler, artist: ArtistHandler, event: WorkHandler, label: LabelHandler, place: PlaceHandler,
        recording: TrackHandler, release: ReleaseHandler, release_group: ReleaseHandler, series: WorkHandler,
        track: TrackHandler, work: WorkHandler,
    };

    // ── MB/GuessCase/Main.js, with options in place of cookies ──────────────────────────
    const MODE_NAMES = Object.keys(MODES);
    const LANGUAGE_MODES = { eng: 'English', fra: 'French', tur: 'Turkish', spa: 'Spanish', ita: 'Italian', por: 'Portuguese', nld: 'Dutch' };
    // MusicBrainz's language ids (its language table, the editors' select values) for those
    const LANGUAGE_IDS = { 113: 'nld', 120: 'eng', 134: 'fra', 195: 'ita', 340: 'por', 393: 'spa', 433: 'tur' };

    /** The mode for a language, as ISO 639-3 or MusicBrainz's language id: the language's own
     *  mode when there is one, Sentence for any other (German too: its nouns can't be guessed),
     *  English when none is given, as MusicBrainz's default. */
    function modeFor(language) {
        if (language == null || language === '') return 'English';
        const code = /^\d+$/.test(String(language)) ? LANGUAGE_IDS[language] : String(language).toLowerCase();
        return LANGUAGE_MODES[code] || 'Sentence';
    }

    // ── Ours, on top of MusicBrainz's result (`extras: false` leaves them out) ──────────
    // Version words MusicBrainz misses, lowercased inside brackets (from chaban's Guess Case Improver).
    const VERSION_PHRASES = ['official lyric video', 'official music video', 'official video', 'official visualizer',
        'official visualiser', 'official audio', 'kinetic lyric video', 'lyric video', 'lyrics video', 'music video',
        'backing track', 'animated', 'animation', 'super slowed', 'extra slowed', 'ultra slowed', 'slowed down',
        'slowed', 'super sped up', 'sped up', 'super speed up', 'speed up', 'low pitched', 'reverb', 'nightcore',
        'bootleg', 'mashup', 'flip'];
    // a whole word or phrase: no letter or digit either side
    const wholeWord = (alternatives, flags) => new RegExp(String.raw`(?<![\p{L}\p{N}])(` + alternatives + String.raw`)(?![\p{L}\p{N}])`, flags);
    const VERSION_RE = wholeWord(VERSION_PHRASES.join('|'), 'giu');
    const TITLE_ENTITIES = new Set(['track', 'recording', 'release', 'release_group', 'work']);

    function versionWords(out, keepUpper) {
        return out.replace(/([([［（【])([^()[\]［］（）【】]*)([)\]］）】])/g, (m, open, inner, close) =>
            open + inner.replace(VERSION_RE, w => (keepUpper && w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()) ? w : w.toLowerCase()) + close);
    }

    // A word written with a capital inside it (KoRn, JoJo, DeBarge, OutKast) keeps it.
    function camelCase(out, source) {
        const words = source.match(/[\p{L}\p{N}]+/gu) || [];
        for (const w of new Set(words.filter(x => /\p{Ll}\p{Lu}/u.test(x)))) out = out.replace(wholeWord(escapeRegExp(w), 'giu'), w);
        return out;
    }

    function run(method, s, o) {
        o = o || {};
        const entity = o.entity || 'track';
        if (entity === 'genre' || entity === 'instrument') return String(s).toLowerCase();   // MusicBrainz lowercases them, sort name too
        const H = HANDLERS[entity];
        if (!H) throw new Error('mbuGuessCase: unknown entity ' + entity);
        const modeName = o.mode && MODES[o.mode] ? o.mode : modeFor(o.language);
        const mode = MODES[modeName](makeDefaultMode(o));
        const keepUpper = o.keepUpperCase !== false;          // MusicBrainz's default: keep
        const flags = new Flags();
        const regexes = { SERIES_NUMBER: /^(\d+|[ivx]+)$/i, SPACES_DOTS: /\s|\./i };
        const input = new Input(s, mode, keepUpper, regexes, flags);
        const output = new Output(input, mode, keepUpper, flags);
        const handler = new H(mode, regexes, input, output, flags);
        const num = handler.checkSpecialCase(s);
        if (handler.isSpecialCase(num)) return handler.getSpecialCaseFormatted(s, num);
        if (method === 'guessSortName') return handler.guessSortName(s, !!o.isPerson);
        let out = handler.process(s);
        if (o.extras !== false && TITLE_ENTITIES.has(entity)) {
            out = versionWords(out, keepUpper);
            if (keepUpper) out = camelCase(out, s);
        }
        return out;
    }

    /** A title in MusicBrainz's guess case. Options: entity ('track' default, 'release',
     *  'release_group', 'recording', 'work', 'artist', 'label', 'area', 'place', 'event',
     *  'series', 'genre', 'instrument'), mode or language, keepUpperCase (true), romanUpper
     *  (false), extras (true: our rules on top; false gives exactly MusicBrainz's result). */
    function guessCase(title, opts) { return run('process', String(title == null ? '' : title), opts); }
    guessCase.sortName = (name, opts) => run('guessSortName', String(name == null ? '' : name), opts);
    guessCase.modeFor = modeFor;
    guessCase.modes = MODE_NAMES;
    return guessCase;
})();
// END-OF-BLOCK — the sync copies everything above this line.

export default mbuGuessCase;
export { mbuGuessCase };
