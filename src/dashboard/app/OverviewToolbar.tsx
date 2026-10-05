import type {
  DashboardExplorer,
  ExplorerReadyPage
} from '#/dashboard/atoms/explorer.js'
import styler from '@alinea/styler'
import {useSetAtom} from 'jotai'
import {useTransition} from 'react'
import {ExplorerActions, ExplorerSearch} from './Explorer.js'
import {ExplorerControls} from './ExplorerControls.js'
import css from './OverviewToolbar.module.css'
import {ViewToggle} from './ViewToggle.js'

const styles = styler(css)

export interface OverviewToolbarProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
  /** The name of the listed location, used in the search placeholder */
  label: string
  /** The list has scrolled under the toolbar */
  scrolled?: boolean
}

/** Search, filters, order and view of an overview */
export function OverviewToolbar({
  explorer,
  page,
  label,
  scrolled = false
}: OverviewToolbarProps) {
  const setView = useSetAtom(explorer.view)
  const setSort = useSetAtom(explorer.requestedSort)
  const toggleFilter = useSetAtom(explorer.toggleFilter)
  const clearFilters = useSetAtom(explorer.clearFilters)
  const [, startTransition] = useTransition()
  return (
    <div className={styles.OverviewToolbar({scrolled})}>
      <div className={styles.OverviewToolbar.search()}>
        <ExplorerSearch
          explorer={explorer}
          page={page}
          placeholder={`Search in ${label}`}
        />
      </div>
      <ExplorerControls
        sorts={page.search.trim() ? [] : page.overview.sorts}
        sort={page.sort.requested}
        sortLabel={page.sort.label}
        filters={page.overview.filters}
        picked={page.filters}
        onSort={sort => startTransition(() => setSort(sort))}
        onToggleFilter={(filter, option) =>
          startTransition(() => toggleFilter(filter, option))
        }
        onReset={() =>
          startTransition(() => {
            clearFilters()
            setSort(undefined)
          })
        }
      />
      <div className={styles.OverviewToolbar.end()}>
        <ExplorerActions page={page} />
        <ViewToggle view={page.view} setView={setView} />
      </div>
    </div>
  )
}
