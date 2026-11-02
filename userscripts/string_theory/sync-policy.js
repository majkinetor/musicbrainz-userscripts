// Everything in the bundle's GM namespace is portable unless excluded here (#885).
// localStorage is shared with MusicBrainz and other extensions: only our namespaces qualify.
function stSyncAllow(kind, key, path) {
  path = path || [];
  if (kind === 'local' && !/^(?:mbu[.:]|mbtools:|apollo(?:Editor[.:]|:)|artstation:|ch[.:]|eh[.:]|falcon:|fc[.:]|fusion[.:]|gt[.:-]|ii:|mc[.:]|pc:|mammoth[.:-]|string_theory[.:]|st:)/.test(key)) return false;
  // Retained data and state which is never authoritative on another device.
  if (/^string_theory\.sync\.(?:state|base|stage|recovery|lease|origins)$/.test(key)) return false;
  if (/^(?:areaImg|avatars|collections|profile|visits|searches|ae-tp-recent|gt-txp-recent|gt-role-history|aiScanLast)$/.test(key)) return false;
  if (/(?:logwin|log-window|:session:|:log(?:$|:)|:bg-log$|(?:^|[.:-])winstate$|dialogSize$|:col_widths$|^gt-tp-ecol$)/i.test(key)) return false;
  if (/(?:cache(?:$|[.:])|^mbu[.:]artimg|^mbu:mb-gate|^mbu[.:]claim|^mbu[.:]owner|extLinksHeading|^eh\.(?:kept|ratings|relhd)|^pc:apple-storefronts)/i.test(key)) return false;
  if (/^apollo\.picks\..*\.open$/.test(key)) return false;
  if (/^artstation:typeNames:/.test(key)) return false;
  if (/(?:pending|handoff|harvest|oauth_oob_code|beatport_close|reloadedAfterImport|:match-changed|:bg-barcode|:pasted-barcode|:picked-catno|:forced:|^gt:createTab|^mc\.after)/i.test(key)) return false;
  if (/^(?:fc\.(?:pos|scroll)|falcon:workerSize|pc:dock-[vhw]|mbu\.(?:cornerFlow|cornerSide|cornerSize|dockOrder|dockKnown|dockOpen|dockHover|logHistory)|st:news:full)$/.test(key)) return false;
  if (/^(?:ii:interface|pc:(?:interface|layout|row-gap|col-gap|name-size|icon-size))$/.test(key)) return false;
  if (!path.length) return true;
  var field = path[0];
  if (key === 'view') {
    // Layout stays local; section order/visibility, stars and named filters are portable.
    if (/^(?:width|cols|colPick|colW|fold|discFold|grpFold|fxOpen|edView|rgView|dgView|tabView|releaseListView|plSize|starView|recView)$/.test(field)) return false;
    if (field === 'named' && path.length > 1 && /^cols-/.test(path[1])) return false;
    // Star thumbnails are fetched cache; keep the user's entity identity and label.
    if (field === 'stars' && path[path.length - 1] === 'img') return false;
  }
  if (key === 'string_theory.theme' && /^(?:lat|lon)$/.test(field)) return false;
  if (key === 'string_theory.palette' && /^(?:recent|last)$/.test(field)) return false;
  if (key === 'stNews' && /^(?:at|items)$/.test(field)) return false;
  if (key === 'apolloEditor.settings.v1' && /^(?:colWidths|layout|lastTool|lastView|srHistory|srHistoryOpen)$/.test(field)) return false;
  if (/^apollo\.picks\./.test(key) && field === 'recent') return false;
  if (key === 'fusion.settings' && /^(?:poolCollapsed|poolSort)$/.test(field)) return false;
  if (key === 'mammoth:settings' && /^(?:visibleRows|sideWidth|minimized|btnChars)$/.test(field)) return false;
  if (key === 'mammoth:data' && path.length > 1 && path[1] === 'history') return false;
  if (key === 'mc.settings' && /^(?:left|right|linkedOpen|ccDiffOpen)$/.test(field)) return false;
  if (key === 'artstation:settings' && /^(?:tile|group|sort|detailed)$/.test(field)) return false;
  if (/(?:^|[._-])(?:window|position|coordinates|colWidths|columnWidths|columns|windowState|editorPath|editorCommand|localPath)$/i.test(field)) return false;
  return true;
}
