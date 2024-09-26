'use client'

import {fromModule, HStack} from 'alinea/ui'
import Link from 'next/link'
import {useParams, usePathname} from 'next/navigation'
import {ComponentProps, useMemo} from 'react'
import {getFramework} from './Frameworks'
import css from './NavTree.module.scss'
import {Nav, NavItem, nestNav} from './NestNav'

const styles = fromModule(css)

function useNavTree(nav: Nav) {
  return useMemo(() => nestNav(nav), [nav])
}

interface MaybeLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href?: string
}

function MaybeLink(props: MaybeLinkProps) {
  if (!props.href) return props.children
  return (
    <Link {...props} href={props.href!}>
      {props.children}
    </Link>
  )
}

interface NavTreeItemProps {
  level: number
  page: NavItem
}

function NavTreeItem({level, page}: NavTreeItemProps) {
  const pathname = usePathname()
  const framework = getFramework(useParams().framework as string)
  const url = page.url && framework.link(page.url)
  const isContainer = page.children && page.children.length > 0
  const isActive = pathname === url
  return (
    <>
      {isContainer ? (
        <div className={styles.root.sub()}>
          <MaybeLink href={url}>
            <HStack
              center
              gap={8}
              className={styles.root.link({
                category: true,
                active: isActive
              })}
            >
              <span>{page.label || page.title}</span>
            </HStack>
          </MaybeLink>
          {page.children && <NavTree nav={page.children} level={level + 1} />}
        </div>
      ) : (
        <div>
          <MaybeLink
            href={url}
            className={styles.root.link({
              active: isActive
            })}
          >
            <HStack center gap={8}>
              {/*level === 0 && (
                  <IcRoundKeyboardArrowRight
                    className={styles.root.link.icon()}
                  />
                )*/}
              <span>{page.label || page.title}</span>
            </HStack>
          </MaybeLink>
        </div>
      )}
    </>
  )
}

export type NavTreeProps = {
  nav: Array<NavItem>
  level?: number
  open?: boolean
}

export function NavTree({nav, level = 0, open = true}: NavTreeProps) {
  const tree = useNavTree(nav)
  return (
    <div className={styles.root(`level-${level}`, {open})}>
      {tree.map(page => {
        return <NavTreeItem key={page.id} level={level} page={page} />
      })}
    </div>
  )
}
