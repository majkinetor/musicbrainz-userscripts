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
