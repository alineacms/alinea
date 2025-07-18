'use client'

import styler from '@alinea/styler'
import {HStack} from 'alinea/ui'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import Link from 'next/link'
import {useParams, usePathname} from 'next/navigation'
import {type ComponentProps, useEffect, useMemo, useState} from 'react'
import {getFramework} from './Frameworks'
import css from './NavTree.module.scss'
import {type Nav, type NavItem, nestNav} from './NestNav'

const styles = styler(css)

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
  const [showChildren, setShowChildren] = useState<boolean | undefined>(
    undefined
  )
  const url = page.url && framework.link(page.url)
  const isOpen = Boolean(
    level < 1 || (showChildren ?? (url && pathname.startsWith(url)))
  )
  const isContainer = page.children && page.children.length > 0
  const isActive = pathname === url
  useEffect(() => {
    setShowChildren(undefined)
  }, [pathname])
  return (
    <>
      {isContainer ? (
        <div className={styles.root.sub()}>
          <MaybeLink href={url}>
            <HStack
              center
              gap={8}
              className={styles.root.link({
                active: isActive,
                root: level === 0
              })}
            >
              {level > 0 &&
                (isOpen ? (
                  <IcRoundKeyboardArrowDown
                    className={styles.root.link.icon()}
                  />
                ) : (
                  <IcRoundKeyboardArrowRight
                    className={styles.root.link.icon()}
                  />
                ))}
              <span>{page.label || page.title}</span>
            </HStack>
          </MaybeLink>
          {page.children && (
            <NavTree nav={page.children} level={level + 1} open={isOpen} />
          )}
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
