import type {EntryUrlMeta} from 'alinea/core/Type'

// Top level entries below /docs group the sidebar navigation ("Get started",
// "Guides", ...). Their path is left out of the urls of the pages they
// contain, so /docs/guides/deploy is served at /docs/deploy.
export function docsEntryUrl({defaultUrl, parentPaths, path}: EntryUrlMeta) {
  const [docs, _group, ...rest] = parentPaths
  if (docs !== 'docs' || parentPaths.length < 2) return defaultUrl
  return `/${[docs, ...rest, path].join('/')}`
}
