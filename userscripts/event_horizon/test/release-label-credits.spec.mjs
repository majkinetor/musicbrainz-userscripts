import { test, expect, functionSource, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test('release loader requests label relationships and preserves their credited names and label links', { tag: '@unit' }, async () => {
  const code = await readFile(sourceOf('event_horizon'), 'utf8');
  expect(code.match(/async function load\(id[\s\S]*?const inc = '([^']+)'/)[1].split('+')).toContain('label-rels');
  const src = await functionSource('event_horizon', ['release', 'creditsOf', 'phrase', 'MODS', 'crName', 'labelCreditsOf']);
  const rels = ['copyright', 'distributed', 'phonographic copyright'].map((type, i) => ({
    type, 'target-type': 'label', direction: 'backward', 'target-credit': i === 1 ? 'Credited distributor' : '',
    label: { id: 'label-' + i, name: 'Label ' + i, disambiguation: i === 1 ? 'publisher' : '' },
  }));
  const { release, crName } = new Function(`
    const urlsOf = () => [], nameOf = () => '', MB = 'https://test.musicbrainz.org', S = { dis: 'below' };
    const esc = s => String(s), entA = (kind, id, name) => '<a href="' + MB + '/' + kind + '/' + id + '">' + name + '</a>';
    ${src}
    return { release, crName };
  `)();
  const result = release({ id: 'id', relations: rels }, { id: 'rg' }, []);
  expect(result.credits).toHaveLength(3);
  expect(result.credits.map(c => c.role)).toEqual(['Copyrighted (©) by', 'Distributed by', 'Phonographic copyright (℗) by']);
  expect(crName(result.credits[0])).toContain('/label/label-0');
  expect(crName(result.credits[1])).toContain('/label/label-1');
  expect(crName(result.credits[1])).toContain('Credited distributor');
});
