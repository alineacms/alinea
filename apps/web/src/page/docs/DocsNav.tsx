'use client'

import styler from '@alinea/styler'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useState} from 'react'
import css from './DocsNav.module.scss'
import {DocsIconChevronRight} from './DocsIcons'

const styles = styler(css)

export interface DocsNavItem {
  id: string
  title: string
  url: string
  children: Array<DocsNavItem>
}

export interface DocsNavGroup {
  id: string
  title: string
  items: Array<DocsNavItem>
}

function contains(item: DocsNavItem, pathname: string): boolean {
  return (
    item.url === pathname ||
    item.children.some(child => contains(child, pathname))
  )
}

interface DocsNavLinkProps {
  item: DocsNavItem
  pathname: string
  level: number
}

function DocsNavLink({item, pathname, level}: DocsNavLinkProps) {
  const isActive = item.url === pathname
  const isContainer = item.children.length > 0
  const isCurrentBranch = isContainer && contains(item, pathname)
  const [toggled, setToggled] = useState<{
    pathname: string
    open: boolean
  }>()
  // A manual toggle only lasts until the next navigation
  const isOpen = toggled?.pathname === pathname ? toggled.open : isCurrentBranch
  return (
    <>
      <div className={styles.item()}>
        <Link
          href={item.url}
          aria-current={isActive ? 'page' : undefined}
          className={styles.link({
            active: isActive,
            nested: level > 0,
            container: isContainer
          })}
        >
          {item.title}
        </Link>
        {isContainer && (
          <button
            type="button"
            className={styles.toggle({open: isOpen})}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.title}`}
            onClick={() => setToggled({pathname, open: !isOpen})}
          >
            <DocsIconChevronRight className={styles.toggle.icon()} />
          </button>
        )}
      </div>
      {isContainer && isOpen && (
        <div className={styles.children()}>
          {item.children.map(child => (
            <DocsNavLink
              key={child.id}
              item={child}
              pathname={pathname}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </>
  )
}

export interface DocsNavProps {
  groups: Array<DocsNavGroup>
}

export function DocsNav({groups}: DocsNavProps) {
  const pathname = usePathname()
  return (
    <nav aria-label="Documentation" className={styles.root()}>
      {groups.map(group => (
        <div key={group.id} className={styles.group()}>
          <span className={styles.group.title()}>{group.title}</span>
          {group.items.map(item => (
            <DocsNavLink
              key={item.id}
              item={item}
              pathname={pathname}
              level={0}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}
