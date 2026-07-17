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
