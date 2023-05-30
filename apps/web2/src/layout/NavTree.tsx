import {fromModule, HStack} from 'alinea/ui'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import Link from 'next/link'
import {useRouter} from 'next/router'
import {useEffect, useMemo, useState} from 'react'
import css from './NavTree.module.scss'

const styles = fromModule(css)

function nestNav(pages: Nav) {
  const res: Array<NavItem> = []
  const root = new Map<string, NavItem>(
    pages.map(page => [page.id, {...page, children: []}])
  )
  for (const page of pages) {
    if (!root.has(page.parent!)) {
      res.push(root.get(page.id)!)
    } else {
      root.get(page.parent!)!.children!.push(root.get(page.id)!)
    }
  }
  return res
}

export function useNavTree(nav: Nav) {
  return useMemo(() => nestNav(nav), [nav])
}

export type Nav = Array<Omit<NavItem, 'children'> & {parent?: string}>

export type NavItem = {
  id: string
  url?: string
  // type: string
  title?: string
  label?: string
  children?: Array<NavItem>
}

interface NavTreeItemProps {
  level: number
  page: NavItem
}

function NavTreeItem({level, page}: NavTreeItemProps) {
  const router = useRouter()
  const pathname = router.asPath
  const [showChildren, setShowChildren] = useState<boolean | undefined>(
    undefined
  )
  const isOpen = showChildren ?? pathname.startsWith(page.url!)
  const isContainer = page.children && page.children.length > 0
  useEffect(() => {
    setShowChildren(undefined)
  }, [pathname])
  return (
    <>
      {isContainer ? (
        <div className={styles.root.sub()}>
          <HStack
            center
            gap={8}
            className={styles.root.link({selected: isOpen, category: true})}
            onClick={e => {
              e.preventDefault()
              setShowChildren(!isOpen)
            }}
          >
            {isOpen ? (
              <IcRoundKeyboardArrowDown className={styles.root.link.icon()} />
            ) : (
              <IcRoundKeyboardArrowRight className={styles.root.link.icon()} />
            )}
            <span>{page.label || page.title}</span>
          </HStack>
          {page.children && (
            <NavTree nav={page.children} level={level + 1} open={isOpen} />
          )}
        </div>
      ) : (
        <div>
          <Link
            href={page.url!}
            className={styles.root.link({
              active: pathname === page.url
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
          </Link>
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
  return (
    <div className={styles.root(`level-${level}`, {open})}>
      {nav.map(page => {
        return <NavTreeItem key={page.id} level={level} page={page} />
      })}
    </div>
  )
}
