import {aliasUrl, aliasUrlsFromData} from '#/core/db/EntryAliases.js'
import {Field} from '#/core/Field.js'
import {ListRow} from '#/core/ListRow.js'
import {Type} from '#/core/Type.js'
import {ListEditor} from '#/core/field/ListField.js'
import {assert} from '#/core/util/Assert.js'
import {isValidOrderKey} from '#/core/util/FractionalIndexing.js'
import {isRecord} from '#/core/util/Objects.js'

/** Entries of the type keep URL aliases in their metadata */
export function hasUrlAliases(type: Type): boolean {
  const metadata = Type.field(type, 'metadata')
  if (!metadata) return false
  const options = Field.options(metadata)
  const fields = (options as {fields?: unknown}).fields
  return Type.isType(fields) && Boolean(Type.field(fields, 'aliases'))
}

export function dataWithUrlAlias(
  type: Type,
  data: Record<string, unknown>,
  previousUrl: string,
  currentUrl: string
): Record<string, unknown> {
  if (!hasUrlAliases(type)) return data
  const aliasUrls = aliasUrlsFromData(data)
  if (aliasUrls.includes(previousUrl)) return data
  const nextData = aliasUrls.includes(currentUrl)
    ? withoutUrlAlias(data, currentUrl)
    : data
  return dataWithUrlAliases(nextData, [previousUrl])
}

/**
 * Adds the urls that are not an alias yet to the aliases in the metadata,
 * marked with the id of the entry that was removed from them, if any
 */
export function dataWithUrlAliases(
  data: Record<string, unknown>,
  urls: Array<string>,
  removed?: string
): Record<string, unknown> {
  const existing = aliasUrlsFromData(data)
  const added = new Set(urls.filter(url => url && !existing.includes(url)))
  if (added.size === 0) return data
  const metadata = isRecord(data.metadata) ? data.metadata : {}
  const current = Array.isArray(metadata.aliases) ? metadata.aliases : []
  const aliases = Array.from(added).reduce(
    (rows, url) => rows.concat(createUrlAliasRow(url, rows, removed)),
    current
  )
  return {...data, metadata: {...metadata, aliases}}
}

/** The data without the aliases of the url that a removed entry left */
export function withoutRemovedAlias(
  data: Record<string, unknown>,
  url: string
): Record<string, unknown> {
  return withoutUrlAlias(
    data,
    url,
    alias => isRecord(alias) && typeof alias.removed === 'string'
  )
}

function withoutUrlAlias(
  data: Record<string, unknown>,
  url: string,
  matches = (_alias: unknown): boolean => true
): Record<string, unknown> {
  const metadata = data.metadata
  if (!isRecord(metadata) || !Array.isArray(metadata.aliases)) return data
  const aliases = metadata.aliases.filter(
    alias => aliasUrl(alias) !== url || !matches(alias)
  )
  if (aliases.length === metadata.aliases.length) return data
  return {...data, metadata: {...metadata, aliases}}
}

interface UrlAliasRow extends ListRow {
  _type: 'alias'
  url: string
  removed?: string
}

function createUrlAliasRow(
  url: string,
  aliases: Array<unknown>,
  removed?: string
) {
  const editor = new ListEditor<UrlAliasRow>(
    aliases.filter(isOrderedUrlAliasRow)
  )
  const row = removed ? {url, removed} : {url}
  const created = editor.add('alias', row).value().at(-1)
  assert(created)
  return created
}

function isOrderedUrlAliasRow(value: unknown): value is UrlAliasRow {
  if (!isRecord(value)) return false
  const id = value[ListRow.id]
  const index = value[ListRow.index]
  return (
    typeof id === 'string' &&
    typeof index === 'string' &&
    isValidOrderKey(index) &&
    value[ListRow.type] === 'alias' &&
    typeof value.url === 'string'
  )
}
