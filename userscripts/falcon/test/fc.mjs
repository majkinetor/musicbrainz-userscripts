// Shared setup for Falcon's specs.
import { replayWs } from '../../../dev/test/harness.mjs';

// A Harmony page as it was when recorded (RECORD_WS=1 re-records): Harmony answers from
// live providers and production MusicBrainz, so its actions change under a spec that
// reads them live. The page and everything it loads from Harmony's host is replayed.
export const harmonyReplay = (page, name) =>
  replayWs(page, new URL(`./fixtures/harmony-${name}.json.gz`, import.meta.url), { paths: /(?!)/, web: /^harmony\.pulsewidth\.org\.uk$/ });
