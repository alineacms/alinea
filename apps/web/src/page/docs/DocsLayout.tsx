import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import {DocsMobileNav} from './DocsMobileNav'
import {DocsNav} from './DocsNav'
import {DocsSearch} from './DocsSearch'
import {DocsSidebar} from './DocsSidebar'
import {docsPages, getDocsTree} from './DocsTree'
import css from './DocsLayout.module.scss'

const styles = styler(css)

/**
 * Shared by all docs pages so the sidebar is not remounted (and keeps its
 * scroll position) when navigating between them
 */
export default async function DocsLayout({children}: PropsWithChildren) {
  const tree = await getDocsTree()
  const pages = docsPages(tree).map(({url, title}) => ({url, title}))
  return (
    <div className={styles.root()}>
      <DocsMobileNav pages={pages}>
        <DocsNav groups={tree.groups} />
      </DocsMobileNav>
      <div className={styles.root.inner()}>
        <DocsSidebar top={<DocsSearch />}>
          <DocsNav groups={tree.groups} />
        </DocsSidebar>
        <main id="docs-content" tabIndex={-1} className={styles.root.main()}>
          {children}
        </main>
      </div>
    </div>
  )
}
