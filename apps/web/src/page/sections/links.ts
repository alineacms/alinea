import type {Link} from 'alinea'

export type LabeledLink = Link<{label: string}>

export interface ResolvedLink {
  href: string
  label: string
  target?: string
}

/** Normalize a CMS link with a label field, undefined if it has no href */
export function resolveLink(
  link: LabeledLink | null | undefined
): ResolvedLink | undefined {
  if (!link?.href) return undefined
  const target = link._type === 'url' ? link.target || undefined : undefined
  return {
    href: link.href,
    label: link.fields?.label || link.title || '',
    target
  }
}
