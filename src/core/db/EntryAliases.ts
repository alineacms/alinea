import {isRecord} from '#/core/util/Objects.js'

export function aliasesFromData(
  data: Record<string, unknown>
): Array<unknown> | undefined {
  const metadata = data.metadata
  return isRecord(metadata) && Array.isArray(metadata.aliases)
    ? metadata.aliases
    : undefined
}

export function aliasUrl(value: unknown): string | undefined {
  return isRecord(value) && typeof value.url === 'string'
    ? value.url
    : undefined
}

/** The URLs of the aliases in the metadata, without duplicates */
export function aliasUrlsFromData(
  data: Record<string, unknown>
): Array<string> {
  const result = new Set<string>()
  for (const alias of aliasesFromData(data) ?? []) {
    const url = aliasUrl(alias)
    if (url) result.add(url)
  }
  return Array.from(result)
}

/** The data without the URL aliases in its metadata */
export function dataWithoutAliases(
  data: Record<string, unknown>
): Record<string, unknown> {
  const metadata = data.metadata
  if (!isRecord(metadata) || !('aliases' in metadata)) return data
  const {aliases: _, ...rest} = metadata
  return {...data, metadata: rest}
}
