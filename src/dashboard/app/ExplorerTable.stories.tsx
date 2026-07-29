import {DashboardScopeInternal} from '#/dashboard/hooks.js'
import {createDashboard} from '#/dashboard/atoms/DashboardAtoms.js'
import type {EntryAtoms} from '#/dashboard/atoms/EntryAtoms.js'
import type {ExplorerAtoms} from '#/dashboard/atoms/ExplorerAtoms.js'
import {cms, db} from '#/dashboard/fixture/cms.ts?alinea'
import {views} from '#/field/views.js'
import {createTestConnection} from '#test/CreateConnection.js'
import '#/theme.css'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {useAtomValue} from 'jotai'
import {useDragAndDrop} from 'react-aria-components/useDragAndDrop'
import {ExplorerTable} from './ExplorerTable.js'

const storyStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: 560,
  padding: 24
}

const emptyStyle: CSSProperties = {
  padding: 24,
  color: 'var(--alinea-fg-muted)'
}

const fixtureConnection = createTestConnection(db)

const dashboard = createDashboard(
  db,
  cms.config,
  db.index,
  fixtureConnection,
  views
)

interface ExplorerTableStoryProps {
  explorer: ExplorerAtoms
}

function ExplorerTableStory({explorer}: ExplorerTableStoryProps) {
  const items = useAtomValue(explorer.items)
  const {dragAndDropHooks} = useDragAndDrop<EntryAtoms>({})
  return (
    <ExplorerTable
      dragAndDropHooks={dragAndDropHooks}
      explorer={explorer}
      items={items}
      renderEmptyState={() => <div style={emptyStyle}>No results found</div>}
    />
  )
}

export function Rows() {
  const explorer = useMemo(
    () =>
      dashboard.explore({
        workspace: 'simple',
        root: 'pages'
      }),
    []
  )
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={storyStyle}>
        <ExplorerTableStory explorer={explorer} />
      </div>
    </DashboardScopeInternal>
  )
}

export default {
  title: 'Dashboard / ExplorerTable'
}
