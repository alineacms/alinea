'use client'

import {default as NextLink, LinkProps as NextLinkProps} from 'next/link'
import {usePathname} from 'next/navigation'
import {AnchorHTMLAttributes, PropsWithChildren, useMemo} from 'react'

export interface LinkProps
  extends PropsWithChildren<NextLinkProps>,
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
  const isCurrentPage = currentPathname === linkPathname
  const current = isCurrentPage ? 'page' : isCurrent ? 'true' : undefined
  return <NextLink aria-current={current} {...props} />
}
