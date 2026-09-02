#!/usr/bin/env node
// What has majkinetor said that I have not answered yet?
//
// Written because I missed two of his comments in one afternoon. The failure was
// procedural, not accidental: I was reacting to whatever a notification poller
// happened to surface, one comment at a time, and reading long ones through
// `head -50` — so a comment the poller skipped was invisible, and instructions
// below a collapsed <details> block were cut off mid-message.
//
// This sweeps the whole repo instead of trusting a feed, and prints bodies in
// FULL, never truncated.
//
//   node dev/gh-inbox.mjs            # unanswered only (exit 1 if any)
//   node dev/gh-inbox.mjs --all      # every thread, answered or not
//
// "Unanswered" = he commented after my most recent comment on that issue, or he
// opened/assigned something I have never replied to at all.

import { execFileSync } from 'node:child_process';

const ME = 'claude-ai-milic';
const HIM = 'majkinetor';
<<<<<<< HEAD
=======
// Everyone who is not me is worth reading. Only majkinetor's word is an
// INSTRUCTION — others are input to weigh, not orders to follow — but chaban-mb
// files real bug reports and posts references, and a tool watching one account
// would hide those exactly the way the notification feed hid majkinetor's.
// Authorship is labelled so the distinction stays visible in the output.
>>>>>>> main
const REPO = 'majkinetor/musicbrainz-userscripts';
const ALL = process.argv.includes('--all');

const gh = (args) => {
    try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
    catch (e) { console.error('gh failed: ' + String(e.message || e).slice(0, 200)); process.exit(2); }
};

// open issues, plus anything closed in the last 3 days — a closed issue can still
// carry an instruction, and #565 was closed while I was mid-reply.
const since = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
const issues = [
    ...gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '100', '--json', 'number,title,updatedAt,assignees']),
    ...gh(['issue', 'list', '--repo', REPO, '--state', 'closed', '--limit', '40', '--search', `closed:>=${since}`, '--json', 'number,title,updatedAt,assignees']),
];
const seen = new Set();
const unique = issues.filter(i => !seen.has(i.number) && seen.add(i.number));

let pending = 0;
for (const iss of unique.sort((a, b) => a.number - b.number)) {
    const comments = gh(['api', `repos/${REPO}/issues/${iss.number}/comments`, '--paginate']);
    const mine = comments.filter(c => c.user.login === ME).map(c => c.created_at).sort().pop() || '';
<<<<<<< HEAD
    const his = comments.filter(c => c.user.login === HIM);
=======
    const his = comments.filter(c => c.user.login !== ME && !/\[bot\]$/.test(c.user.login));
>>>>>>> main
    const unanswered = his.filter(c => c.created_at > mine);
    if (!unanswered.length && !ALL) continue;

    const mineAssigned = (iss.assignees || []).some(a => a.login === ME);
    console.log(`\n${'='.repeat(78)}`);
    console.log(`#${iss.number}  ${iss.title}${mineAssigned ? '   [assigned to me]' : ''}`);
    console.log(`my last reply: ${mine || '(never)'}`);
    if (!unanswered.length) { console.log('  — nothing unanswered'); continue; }

    for (const c of unanswered) {
        pending++;
        console.log(`\n--- @${c.user.login} ${c.created_at}  ${c.html_url}`);
        // FULL body. Never head/tail this: his instructions are routinely at the
        // bottom, after collapsed log blocks.
        console.log(c.body);
    }
}

console.log(`\n${'='.repeat(78)}`);
console.log(pending ? `${pending} UNANSWERED comment(s) — read each one to the end and action every imperative in it.` : 'nothing unanswered.');
process.exit(pending ? 1 : 0);
