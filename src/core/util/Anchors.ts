export function createUniqueAnchor(
  slug: string | undefined,
  anchors: Set<string>
): string | undefined {
  if (!slug) return undefined

  let uniqueSlug = slug
  let count = 2
  while (anchors.has(uniqueSlug)) {
    uniqueSlug = `${slug}-${count}`
    count += 1
  }
  anchors.add(uniqueSlug)
  return uniqueSlug
}

export function isGeneratedAnchor(
  anchor: string | undefined,
  source: string
): boolean {
  if (anchor === undefined) return true
  if (!source) return false
  if (anchor === source) return true
  if (!anchor.startsWith(`${source}-`)) return false
  return /^[1-9]\d*$/.test(anchor.slice(source.length + 1))
}

export function usedAnchors(
  anchors: Iterable<string>,
  current?: string
): Set<string> {
  const result = new Set<string>()
  let currentCount = 0
  for (const anchor of anchors) {
    result.add(anchor)
    if (anchor === current) currentCount += 1
  }
  if (current && currentCount <= 1) result.delete(current)
  return result
}

export function applyUrlSuffix(
  url: string,
  suffix: string | undefined,
  anchor: string | undefined
): string {
  const base = new URL('http://alinea.local')
  const absolute = URL.canParse(url)
  let result = new URL(url, base)
  if (suffix?.trim()) result = new URL(suffix.trim(), result)
  if (anchor?.trim()) result.hash = anchor.trim().replace(/^#+/, '')
  return absolute
    ? result.href
    : `${result.pathname}${result.search}${result.hash}`
}
