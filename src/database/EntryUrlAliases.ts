import {aliasesFromData, aliasUrl} from '#/core/db/EntryAliases.js'
import {Field} from '#/core/Field.js'
import {ListRow} from '#/core/ListRow.js'
import {Type} from '#/core/Type.js'
import {ListEditor} from '#/core/field/ListField.js'
import {assert} from '#/core/util/Assert.js'
import {isValidOrderKey} from '#/core/util/FractionalIndexing.js'
import {isRecord} from '#/core/util/Objects.js'
import {MetadataField} from '#/field/metadata/MetadataField.js'

function aliasUrlsFromData(data: Record<string, unknown>): Array<string> {
  const result = new Set<string>()
  for (const alias of aliasesFromData(data) ?? []) {
    const url = aliasUrl(alias)
    if (url) result.add(url)
  }
  return Array.from(result)
}

function hasUrlAliases(type: Type): boolean {
  const metadata = Type.field(type, 'metadata')
  if (metadata instanceof MetadataField) return true
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
  const metadata = isRecord(nextData.metadata) ? nextData.metadata : {}
  const aliases = Array.isArray(metadata.aliases) ? metadata.aliases : []
  return dataWithAliases(
    nextData,
    metadata,
    aliases.concat(createUrlAliasRow(previousUrl, aliases))
  )
}

function withoutUrlAlias(
  data: Record<string, unknown>,
  url: string
): Record<string, unknown> {
  const metadata = data.metadata
  if (!isRecord(metadata) || !Array.isArray(metadata.aliases)) return data
  return {
    ...data,
    metadata: {
      ...metadata,
      aliases: metadata.aliases.filter(alias => aliasUrl(alias) !== url)
    }
  }
}

function dataWithAliases(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
  aliases: Array<unknown>
): Record<string, unknown> {
  return {...data, metadata: {...metadata, aliases}}
}

interface UrlAliasRow extends ListRow {
  _type: 'alias'
  url: string
}

function createUrlAliasRow(url: string, aliases: Array<unknown>) {
  const editor = new ListEditor<UrlAliasRow>(
    aliases.filter(isOrderedUrlAliasRow)
  )
  const created = editor.add('alias', {url}).value().at(-1)
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
