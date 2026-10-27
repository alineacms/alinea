import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  PageBack
} from '#/components.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {Fragment, useTransition} from 'react'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardExplorer,
  ExplorerParent,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import css from './ExplorerBreadcrumbs.module.css'

const styles = styler(css)

export interface ExplorerParentBackProps {
  explorer: DashboardExplorer
  parent: ExplorerParent
}

/** Lists the children of the parent of the listed entries, or the root */
export function ExplorerParentBack({
  explorer,
  parent
}: ExplorerParentBackProps) {
  const setLocation = useSetAtom(explorer.location)
  const [, startTransition] = useTransition()
  const parentId = parent.parents.at(-1)
  return (
    <PageBack
      label={parentId ? 'Back to parent entry' : 'Back to root'}
      onClick={() =>
        startTransition(() =>
          setLocation(location => ({...location, parentId}))
        )
      }
    />
  )
}

export interface ExplorerBreadcrumbsProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
}

/** The path from the root to the listed entries, each step opens its level */
export function ExplorerBreadcrumbs({
  explorer,
  page
}: ExplorerBreadcrumbsProps) {
  const config = useAtomValueRaw(configAtom)
  const setLocation = useSetAtom(explorer.location)
  const [, startTransition] = useTransition()
  const {location, parent} = page
  if (page.scope !== 'root' || !location.root) return null
  const workspace = config.workspaces[location.workspace]
  const root = workspace && getWorkspace(workspace).roots[location.root]
  const crumbs = [
    {id: undefined, title: root ? getRoot(root).label : location.root},
    ...(parent ? [...parent.path, parent] : [])
  ]
  // Children are picked where they are, there is nowhere else to go
  const locked = explorer.pickChildren
  return (
    <div className={styles.ExplorerBreadcrumbs()}>
      {parent && !locked && (
        <ExplorerParentBack explorer={explorer} parent={parent} />
      )}
      <Breadcrumb className={styles.ExplorerBreadcrumbs.nav()}>
        <BreadcrumbList className={styles.ExplorerBreadcrumbs.list()}>
          {crumbs.map((crumb, index) => {
            const current = index === crumbs.length - 1
            return (
              <Fragment key={crumb.id ?? ''}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className={styles.ExplorerBreadcrumbs.item()}>
                  {current ? (
                    <BreadcrumbPage
                      className={styles.ExplorerBreadcrumbs.page()}
                    >
                      {crumb.title}
                    </BreadcrumbPage>
                  ) : locked ? (
                    <span className={styles.ExplorerBreadcrumbs.text()}>
                      {crumb.title}
                    </span>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        className={styles.ExplorerBreadcrumbs.link()}
                        onClick={() =>
                          startTransition(() =>
                            setLocation(location => ({
                              ...location,
                              parentId: crumb.id
                            }))
                          )
                        }
                      >
                        {crumb.title}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
