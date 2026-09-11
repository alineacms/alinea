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
