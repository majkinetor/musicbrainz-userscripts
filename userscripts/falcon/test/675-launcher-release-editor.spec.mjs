// #675 (majkinetor): Falcon's corner launcher stands down on MusicBrainz's own
// release editor — /release/add and /release/<mbid>/edit — which is Apollo
// Editor's full-screen Knockout app and has nothing for Falcon to act on. Every
// other page keeps the launcher. onReleaseEditorPage() is the gate ensureLauncher
// consults, right beside its existing "Hide icon" early return.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const MBID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';

test('#675: the launcher is gated off the release editor, on everywhere else', { tag: '@unit' }, async () => {
  const src = await functionSource('falcon', ['onReleaseEditorPage']);
  const on = pathname => new Function('location', `${src}\nreturn onReleaseEditorPage();`)({ pathname });

  // stands down on the release editor
  check(on(`/release/${MBID}/edit`) === true, 'the release edit page hides the launcher');
  check(on('/release/add') === true, 'the release add page hides the launcher');
  check(on('/release/add/') === true, '…trailing slash too');
  check(on(`/release/${MBID}/edit/`) === true, '…trailing slash on /edit too');

  // keeps the launcher everywhere else
  check(on(`/release/${MBID}`) === false, 'a plain release page keeps the launcher');
  check(on(`/release/${MBID}/edit-relationships`) === false, 'the relationship editor is not the release editor');
  check(on(`/artist/${MBID}/edit`) === false, 'an artist edit page keeps the launcher');
  check(on(`/release-group/${MBID}`) === false, 'a release-group page keeps the launcher');
  check(on('/') === false, 'the home page keeps the launcher');
});

// majkinetor, 2026-10-29: outside the test hooks the icon shows only where Falcon can queue
// something, the overview of a release, a release group or a series; never on an edit page
test('the launcher shows on a release, release group or series overview only', { tag: '@unit' }, async () => {
  const src = await functionSource('falcon', ['LAUNCHER_PATHS', 'launcherPage']);
  const at = pathname => new Function(`${src}\nreturn launcherPage(${JSON.stringify(pathname)});`)();
  check(at(`/release/${MBID}`) === true, 'a release page');
  check(at(`/release-group/${MBID}`) === true, 'a release-group page');
  check(at(`/series/${MBID}/`) === true, 'a series page');
  check(at(`/release-group/${MBID}/edit`) === false, 'not a release-group edit page');
  check(at(`/release/${MBID}/edit-relationships`) === false, 'not the relationship editor');
  check(at('/edit/123') === false, 'not an edit');
  check(at(`/artist/${MBID}`) === false, 'not an artist page');
  check(at('/') === false, 'not the home page');
});
