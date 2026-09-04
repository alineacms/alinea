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
  const url =
    typeof value === 'string'
      ? value
      : isRecord(value) && typeof value.url === 'string'
        ? value.url
        : undefined
  if (url === undefined) return undefined
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function aliasUrlsFromData(
  data: Readonly<Record<string, unknown>>
): Array<string> {
  const result = new Set<string>()
  for (const alias of aliasesFromData(data) ?? []) {
    const url = aliasUrl(alias)
    if (url) result.add(url)
  }
  return [...result]
}
