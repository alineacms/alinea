import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import type {SetStateAction} from 'react'
import {IcRoundRemoveRedEye} from '../icons.js'
import type {DashboardEntry, ExplorerLocation} from '../store.js'
import {Badge} from './Badge.js'
import css from './DetailsBar.module.css'
import {LocationBreadcrumbs} from './LocationBreadcrumbs.js'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

interface DetailsBarProps {
  entry: DashboardEntry
  status: 'published' | 'unpublished' | 'draft' | 'archived'
}

export function DetailsBar({entry, status}: DetailsBarProps) {
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const parentId = useAtomValue(entry.parentId) ?? undefined
  const route = useAtomValue(entry.dashboard.route)
  const setRoute = useSetAtom(entry.dashboard.route)
  const location = {workspace, root, parentId}
  const setLocation = (update: SetStateAction<ExplorerLocation>) => {
    const next = typeof update === 'function' ? update(location) : update
    const keepLocale = next.workspace === workspace && next.root === root
    setRoute({
      workspace: next.workspace,
      root: next.root,
      entry: next.parentId,
      locale: keepLocale ? route.locale : undefined
    })
  }

  return (
    <RailHeader className={styles.DetailsBar()} data-status={status}>
      <LocationBreadcrumbs location={location} setLocation={setLocation} />
      <Badge icon={IcRoundRemoveRedEye} appearance="plain">
        Published
      </Badge>
    </RailHeader>
  )
}
