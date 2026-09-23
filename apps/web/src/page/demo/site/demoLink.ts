import type {Link} from 'alinea'

export type DemoLabeledLink = Link<{label: string}>

export interface DemoResolvedLink {
  href: string
  label: string
}

/** A CMS link with a label field, null when it points nowhere */
export function demoLink(
  link: DemoLabeledLink | null | undefined
): DemoResolvedLink | null {
  if (!link?.href) return null
  return {href: link.href, label: link.fields?.label || link.title || ''}
}
