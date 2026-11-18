"""Run with python -m unittest discover -s picard -p test_v3.py."""
import importlib.util
import logging
from pathlib import Path
import sys
import tomllib
import types
import unittest
from unittest.mock import Mock
from uuid import UUID

ROOT = Path(__file__).parent / 'v3'

# Only the two option-page plugins import Picard and Qt at module load time.
picard = types.ModuleType('picard')
plugin3 = types.ModuleType('picard.plugin3')
api_module = types.ModuleType('picard.plugin3.api')
api_module.OptionsPage = type('OptionsPage', (), {})
qt = types.ModuleType('PyQt6')
qt.QtWidgets = types.SimpleNamespace()
sys.modules.update({'picard': picard, 'picard.plugin3': plugin3,
                    'picard.plugin3.api': api_module, 'PyQt6': qt})


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / name / '__init__.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Config(dict):
    def register_option(self, key, default):
        self.setdefault(key, default)


class PluginsTest(unittest.TestCase):
    def setUp(self):
        self.api = Mock()
        self.api.logger = logging.getLogger('test')
        self.api.plugin_config = Config()

    def test_packages_register(self):
        ids = set()
        for folder in ROOT.iterdir():
            if not folder.is_dir() or not (folder / 'MANIFEST.toml').exists():
                continue
            with self.subTest(plugin=folder.name):
                manifest = tomllib.loads((folder / 'MANIFEST.toml').read_text(encoding='utf-8'))
                ids.add(UUID(manifest['uuid']))
                self.assertIn('3.0', manifest['api'])
                load(folder.name).enable(self.api)
        self.assertEqual(len(ids), 6)

    def test_compiler_and_timestamp(self):
        compiler = load('compiler')
        metadata = {}
        release = {'relations': [{'type': 'compiler', 'artist': {'name': 'Name'}}]}
        compiler.process_compiler(self.api, None, metadata, None, release)
        self.assertEqual(metadata['compiler'], 'Name')
        compiler.process_compiler(self.api, None, metadata, None, {})
        self.assertNotIn('compiler', metadata)
        self.assertRegex(load('timestamp').timestamp(None), r'^\d{4}-\d\d-\d\d \d\d:\d\d$')

    def test_relationship_request_and_mapping(self):
        rel = load('relationships')
        rel.enable(self.api)
        album = object()
        rel.fetch_extra_relations(self.api, album, {}, {'id': 'release-id'})
        args, kwargs = self.api.add_album_task.call_args
        self.assertTrue(kwargs['blocking'])
        kwargs['request_factory']()
        request = self.api.web_service.get_url.call_args.kwargs
        self.assertEqual(request['parse_response_type'], 'json')
        request['handler']({'relations': [{'target-type': 'place', 'type': 'recorded at',
                                            'place': {'name': 'Studio'}}]}, None, None)
        self.api.complete_album_task.assert_called_once_with(album, args[1])
        self.assertEqual(rel._extra_relations['release-id'][0]['place']['name'], 'Studio')

    def test_bandcamp_and_discogs_extract(self):
        bandcamp = load('bandcamp_info')
        discogs = load('discogs_info')
        release = {'relations': [{'target-type': 'url', 'url': {'resource': 'https://discogs.com/release/123'}}]}
        self.assertEqual(discogs.get_discogs_ids(release), ('123', None))
        self.assertEqual(bandcamp.html_to_text('A<br>B &amp; C'), 'A\nB & C')


if __name__ == '__main__':
    unittest.main()
