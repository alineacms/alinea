import {isRecord} from '#/core/util/Objects.js'

export function aliasesFromData(
  data: Record<string, unknown>
): Array<unknown> | undefined {
  const result = Array<unknown>()
  let hasAliases = false
  if (Array.isArray(data.aliases)) {
    hasAliases = true
    result.push(...data.aliases)
  }
  const metadata = data.metadata
  if (isRecord(metadata) && Array.isArray(metadata.aliases)) {
    hasAliases = true
    result.push(...metadata.aliases)
  }
  return hasAliases ? result : undefined
}

export function aliasUrl(value: unknown): string | undefined {
  return isRecord(value) && typeof value.url === 'string'
    ? value.url
    : undefined
}

export function aliasUrlsFromData(
  data: Readonly<Record<string, unknown>>
): Array<string> {
  return [
    ...new Set(
      (aliasesFromData(data) ?? []).flatMap(alias => {
        const url = aliasUrl(alias)
        return url === undefined ? [] : [url]
      })
    )
  ]
}
