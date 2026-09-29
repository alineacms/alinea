'use client'

import {default as NextLink, type LinkProps as NextLinkProps} from 'next/link'
import {usePathname} from 'next/navigation'
import {type AnchorHTMLAttributes, type PropsWithChildren, useMemo} from 'react'

export interface LinkProps
  extends
    PropsWithChildren<NextLinkProps>,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextLinkProps> {
  href: string
  activeFor?: string
}

export function Link({activeFor, ...props}: LinkProps) {
  const currentPathname = usePathname()
  const linkPathname = useMemo(() => {
    return new URL(props.href, 'http://localhost').pathname
  }, [props.href])
  const isCurrent = currentPathname.startsWith(activeFor || linkPathname)
  // Links to a section of a page (eg. /#features) do not mark the page current
  const isSectionLink = props.href.includes('#')
  const isCurrentPage = !isSectionLink && currentPathname === linkPathname
  const current = isCurrentPage ? 'page' : isCurrent ? 'true' : undefined
  return <NextLink aria-current={current} {...props} />
}
