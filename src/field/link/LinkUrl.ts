import {applyUrlSuffix} from '#/core/util/Anchors.js'

const openableProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/** The absolute url of a link, unless it would run script like javascript: */
export function openableUrl(
  url: string | undefined,
  base: string
): string | undefined {
  if (!url) return undefined
  const parsed = URL.parse(url, base)
  return parsed && openableProtocols.has(parsed.protocol)
    ? parsed.href
    : undefined
}

/** The url with its suffix and anchor, unless a half typed suffix breaks it */
export function suffixedUrl(
  url: string,
  suffix: string | undefined,
  anchor: string | undefined
): string | undefined {
  try {
    return applyUrlSuffix(url, suffix, anchor)
  } catch {
    return undefined
  }
}
