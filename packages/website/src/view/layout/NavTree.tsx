import {fromModule, HStack} from '@alinea/ui'
import Link from 'next/link'
import {Fragment, useMemo} from 'react'
import {MdExpandMore} from 'react-icons/md'
import css from './NavTree.module.scss'

const styles = fromModule(css)

function nestNav<T extends {id: string; parent: string | undefined}>(
  pages: Array<T>
) {
  type Page = T & {children: Array<Page>}
  const res: Array<Page> = []
  const root = new Map<string, Page>(
    pages.map(page => [page.id, {...page, children: []}])
  )
  for (const page of pages) {
    if (!root.has(page.parent!)) {
      res.push(root.get(page.id)!)
    } else {
      root.get(page.parent!)!.children.push(root.get(page.id)!)
    }
  }
  return res
}

export function useNavTree(
  nav: Array<Omit<NavItem, 'children'> & {parent: string | undefined}>
) {
  return useMemo(() => nestNav(nav), [nav])
}

type NavItem = {
  id: string
  url: string
  type: string
  title: string
  children: Array<NavItem>
}

export type NavTreeProps = {
  nav: Array<NavItem>
  level?: number
}

export function NavTree({nav, level = 0}: NavTreeProps) {
  return (
    <div className={styles.root()}>
      {nav.map(page => {
        const isContainer = page.children.length > 0
        return (
          <Fragment key={page.id}>
            {isContainer ? (
              <>
                {level === 0 ? (
                  <h2 className={styles.root.header()}>{page.title}</h2>
                ) : (
                  <HStack center gap={8}>
                    <MdExpandMore />
                    <span>{page.title}</span>
                  </HStack>
                )}
                <NavTree nav={page.children} level={level + 1} />
              </>
            ) : (
              <div>
                <Link href={page.url}>
                  <a className={styles.root.link()}>{page.title}</a>
                </Link>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
