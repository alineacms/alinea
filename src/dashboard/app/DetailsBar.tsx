import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import type {ReactNode, SetStateAction} from 'react'
import {
  IcOutlineArchive,
  IcOutlineRemoveRedEye,
  IcRoundEdit,
  IcRoundFlashOn
} from '../icons.js'
import type {DashboardEntryData, ExplorerLocation} from '../store.js'
import {Badge} from './Badge.js'
import css from './DetailsBar.module.css'
import {LocationBreadcrumbs} from './LocationBreadcrumbs.js'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export type DetailsBarStatus =
  | 'published'
  | 'unpublished'
  | 'draft'
  | 'archived'

interface DetailsBarProps {
  entry: DashboardEntryData
  status: DetailsBarStatus
  statusLabel: ReactNode
}

function statusIcon(status: DetailsBarStatus) {
  switch (status) {
    case 'published':
      return IcOutlineRemoveRedEye
    case 'unpublished':
      return IcRoundFlashOn
    case 'archived':
      return IcOutlineArchive
    default:
      return IcRoundEdit
  }
}

export function DetailsBar({entry, status, statusLabel}: DetailsBarProps) {
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
      <Badge icon={statusIcon(status)} appearance="plain">
        {statusLabel}
      </Badge>
    </RailHeader>
  )
}
