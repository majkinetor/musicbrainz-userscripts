// Activate the repo-wide pre-commit hook by pointing the clone's
// `core.hooksPath` at `.githooks/` (a tracked dir at the repo root).
//
// Runs from `package.json`'s `prepare` script on every `pnpm install`, so
// new contributors get the hook automatically — no extra setup step,
// no husky / lefthook dependency. Idempotent: safe to run repeatedly.
//
// Silent no-op when not inside a git checkout (e.g. tarball installs,
// CI without history) — there's nothing to configure in that case.

import { execSync } from 'node:child_process';

try {
    const root = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    execSync('git config core.hooksPath .githooks', { cwd: root });
    // Quiet on success — `pnpm install` is noisy enough already.
} catch {
    // Not in a git checkout, or no git on PATH. Nothing to do.
}
