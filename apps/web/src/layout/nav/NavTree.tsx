'use client'

import styler from '@alinea/styler'
import {IcRoundKeyboardArrowDown, IcRoundKeyboardArrowRight} from '@/icons'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {type ComponentProps, useEffect, useMemo, useState} from 'react'
import css from './NavTree.module.scss'
import {type Nav, type NavItem, nestNav} from './NestNav'

const styles = styler(css)

interface MaybeLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href?: string
}

function MaybeLink({href, children, ...props}: MaybeLinkProps) {
  if (!href) return <span className={props.className}>{children}</span>
  return (
    <Link {...props} href={href}>
      {children}
    </Link>
  )
}

interface NavTreeItemProps {
  level: number
  page: NavItem
}

function NavTreeItem({level, page}: NavTreeItemProps) {
  const pathname = usePathname()
  const [showChildren, setShowChildren] = useState<boolean | undefined>(
    undefined
  )
  const url = page.url
  const isOpen = Boolean(
    level < 2 || (showChildren ?? (url && pathname.startsWith(url)))
  )
  const isContainer = Boolean(page.children && page.children.length > 0)
  const isActive = pathname === url
  const label = page.label || page.title
  useEffect(() => {
    setShowChildren(undefined)
  }, [pathname])
  if (!isContainer)
    return (
      <MaybeLink href={url} className={styles.root.link({active: isActive})}>
        <span className={styles.root.link.label()}>{label}</span>
      </MaybeLink>
    )
  return (
    <div className={styles.root.sub()}>
      <MaybeLink
        href={url}
        className={styles.root.link({
          active: isActive,
          root: level === 0,
          group: level === 1
        })}
      >
        {level > 1 &&
          (isOpen ? (
            <IcRoundKeyboardArrowDown className={styles.root.link.icon()} />
          ) : (
            <IcRoundKeyboardArrowRight className={styles.root.link.icon()} />
          ))}
        <span className={styles.root.link.label()}>{label}</span>
      </MaybeLink>
      <NavTree nav={page.children!} level={level + 1} open={isOpen} />
    </div>
  )
}

export interface NavTreeProps {
  nav: Nav
  level?: number
  open?: boolean
}

export function NavTree({nav, level = 0, open = true}: NavTreeProps) {
  const tree = useMemo(() => nestNav(nav), [nav])
  return (
    <div className={styles.root(`level-${level}`, {open})}>
      {tree.map(page => {
        return <NavTreeItem key={page.id} level={level} page={page} />
      })}
    </div>
  )
}
