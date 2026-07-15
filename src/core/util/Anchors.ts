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
