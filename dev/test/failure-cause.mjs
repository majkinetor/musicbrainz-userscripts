// What made a test fail: the test itself, or the environment it ran in.
//
//   rate-limit  MusicBrainz said it was too busy: 429 or 503 answers, the sandbox's
//               "Verification failed" page, or the proxy's "upstream request failed"
//   network     a server did not answer: the connection failed, reset or timed out
//   test        anything else: an assertion, a missing element, a script error
//
// The harness records rate-limit as a "cause" annotation when a failed test met those answers
// (dev/test/harness.mjs), because the error message alone seldom shows it. The nightly history
// keeps the cause of every failure (suite-history.mjs), so the number of workers on one runner
// can follow how often the sandbox throttles them (flaky-report.mjs --causes).
export const THROTTLE_PAGE = /Verification failed\. Please try again|Verifying your browser|upstream request failed|Too Many Requests|rate limit/i;
const RATE_LIMIT = /\b(429|503)\b|Service Unavailable|Too Many Requests|Verification failed|upstream request failed|rate.?limit/i;
const NETWORK = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|net::ERR_|NS_ERROR_NET|Bad Gateway|\b502\b|\b504\b/i;

// cause(errorText, annotations?) → 'rate-limit' | 'network' | 'test'
export function cause(error, annotations = []) {
  const noted = annotations.find(a => a.type === 'cause');
  if (noted && /^rate-limit/.test(noted.description || '')) return 'rate-limit';
  // a report's error quotes the spec's code ("  18 |   …", "> 20 | …") and its stack: only the error
  // itself counts, or a spec that fakes a 503 to test a retry reads as rate-limited (2026-11-28, ISRC Scout 607)
  const text = String(error || '').split('\n').filter(l => !/^\s*>?\s*\d+\s*\|/.test(l) && !/^\s+at\s/.test(l)).join('\n');
  if (RATE_LIMIT.test(text)) return 'rate-limit';
  if (NETWORK.test(text)) return 'network';
  return 'test';
}

// the same for a running test (Playwright's testInfo)
export const failureCause = testInfo => cause((testInfo.errors || []).map(e => e.message || e.value || '').join('\n'), testInfo.annotations);
