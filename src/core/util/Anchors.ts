export function createUniqueAnchor(
  slug: string | undefined,
  anchors: Set<string>
): string | undefined {
  if (!slug) return undefined

  let uniqueSlug = slug
  let count = 1
  while (anchors.has(uniqueSlug)) {
    uniqueSlug = `${slug}-${count}`
    count += 1
  }
  anchors.add(uniqueSlug)
  return uniqueSlug
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
