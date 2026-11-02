import { expect } from '@playwright/test';

export function backupCloud() {
  const files = new Map(), calls = [];
  let folder = false, serial = 0;
  const error = summary => ({ status: 409, text: JSON.stringify({ error_summary: summary }) });
  const result = data => ({ status: 200, text: JSON.stringify(data) });
  const state = { files, calls, denied: false };
  state.request = async opts => {
    const endpoint = new URL(opts.url).pathname;
    const args = JSON.parse(opts.headers['dropbox-api-arg'] || (typeof opts.data === 'string' ? opts.data : '{}'));
    calls.push({ endpoint, args });
    expect(opts.headers.authorization).toBe('Bearer test-access');
    if (state.denied) return { status: 403, text: '{}' };
    if (endpoint.endsWith('/create_folder_v2')) {
      if (folder) return error('path/conflict/folder/');
      folder = true; return result({ metadata: { '.tag': 'folder', path_lower: '/backups' } });
    }
    if (endpoint.endsWith('/upload')) {
      expect(args.path).toMatch(/^\/backups\/string-theory-.*\.json$/);
      expect(args.mode).toEqual({ '.tag': 'add' }); expect(args.strict_conflict).toBe(true); expect(args.autorename).toBe(false);
      if (files.has(args.path)) return error('path/conflict/file/');
      const metadata = { name: args.path.split('/').pop(), path_lower: args.path.toLowerCase(), id: 'id:' + ++serial, rev: 'rev' + serial, size: new Blob([opts.data]).size, server_modified: new Date(Date.now() + serial * 1000).toISOString() };
      files.set(args.path, { metadata, text: typeof opts.data === 'string' ? opts.data : new TextDecoder().decode(opts.data) });
      return result(metadata); // upload returns FileMetadata, without the union's .tag
    }
    if (endpoint.endsWith('/list_folder')) {
      if (!folder) return error('path/not_found/');
      const items = [...files.values()].map(f => ({ '.tag': 'file', ...f.metadata }));
      state.rest = items.slice(1);
      return result({ entries: [{ '.tag': 'folder', name: 'other' }, { '.tag': 'file', id: 'id:sync', rev: 'sync', name: 'string-theory.json', path_lower: '/string-theory.json', size: 100 }, ...items.slice(0, 1)], has_more: !!state.rest.length, cursor: 'next' });
    }
    if (endpoint.endsWith('/list_folder/continue')) { expect(args.cursor).toBe('next'); return result({ entries: state.rest, has_more: false, cursor: 'done' }); }
    const file = [...files.values()].find(f => f.metadata.id === args.path);
    if (endpoint.endsWith('/download')) {
      if (!file || file.metadata.rev !== args.rev) return error('path/not_found/');
      return { status: 200, text: file.text };
    }
    if (endpoint.endsWith('/delete_v2')) {
      if (!file) return error('path_lookup/not_found/');
      if (file.metadata.rev !== args.parent_rev) return error('path_write/conflict/');
      files.delete([...files.keys()].find(k => files.get(k) === file));
      return result({ metadata: file.metadata });
    }
    throw new Error('Unexpected remote backup request: ' + endpoint);
  };
  return state;
}

