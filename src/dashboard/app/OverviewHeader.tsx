import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  PageActions,
  PageHeader,
  PageTitle
} from '#/components.js'
import type {
  DashboardExplorer,
  ExplorerPathEntry,
  ExplorerReadyPage
} from '#/dashboard/atoms/explorer.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {Fragment, type ReactNode} from 'react'
import css from './OverviewHeader.module.css'
import {ReadOnlyBadge} from './ReadOnlyBadge.js'

const styles = styler(css)

export interface OverviewHeaderProps {
  /** Controls at the end of the header, eg. the create button */
  actions?: ReactNode
  explorer: DashboardExplorer
  page: ExplorerReadyPage
  readOnly?: boolean
  /** Title of the overview's entry, for entries outside the tree */
  title?: string
  /** Shown before the breadcrumbs */
  toggle?: ReactNode
}

/** The location of the overview as breadcrumbs, its entry count and actions */
export function OverviewHeader({
  actions,
  explorer,
  page,
  readOnly,
  title,
  toggle
}: OverviewHeaderProps) {
  const rootLabel = useAtomValueRaw(page.root.label)
  const setLocation = useSetAtom(explorer.location)
  const {parent} = page
  const count = page.items.length
  const parents: Array<ExplorerPathEntry | undefined> = parent
    ? [undefined, ...parent.path]
    : title
      ? [undefined]
      : []
  function open(parentId: string | undefined) {
    setLocation(location => ({...location, parentId}))
  }
  return (
    <PageHeader className={styles.OverviewHeader()}>
      {toggle}
      <Breadcrumb className={styles.OverviewHeader.location()}>
        <BreadcrumbList className={styles.OverviewHeader.crumbs()}>
          {parents.map(entry => (
            <Fragment key={entry?.id ?? ''}>
              <BreadcrumbItem className={styles.OverviewHeader.crumb()}>
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    className={styles.OverviewHeader.link()}
                    onClick={() => open(entry?.id)}
                  >
                    {entry ? entry.title : rootLabel}
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator
                className={styles.OverviewHeader.separator()}
              />
            </Fragment>
          ))}
          <BreadcrumbItem className={styles.OverviewHeader.crumb()}>
            <PageTitle className={styles.OverviewHeader.title()}>
              {parent?.title ?? title ?? rootLabel}
            </PageTitle>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <span className={styles.OverviewHeader.count()}>
        {count === 1 ? '1 entry' : `${count} entries`}
      </span>
      {readOnly && <ReadOnlyBadge />}
      {actions && <PageActions>{actions}</PageActions>}
    </PageHeader>
  )
}
