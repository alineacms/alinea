import type {LocalConnection} from '#/core/Connection.js'
import {localUser} from '#/core/User.js'
import {DashboardScopeInternal} from '#/dashboard/hooks.js'
import {
  Dashboard,
  type DashboardEntry,
  type DashboardExplorer
} from '#/dashboard/store.js'
import {cms, db} from '#/dashboard/fixture/cms.ts?alinea'
import {views} from '#/field/views.js'
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

const fixtureConnection: LocalConnection = {
  mutate(mutations) {
    return db.mutate(mutations)
  },
  previewToken() {
    return Promise.resolve('dev-preview-token')
  },
  resolve(query) {
    return db.resolve(query)
  },
  user() {
    return Promise.resolve(localUser)
  },
  write(request) {
    return db.write(request)
  },
  getTreeIfDifferent(sha) {
    return db.getTreeIfDifferent(sha)
  },
  getBlobs(shas) {
    return db.getBlobs(shas)
  },
  revisions(file) {
    return db.revisions(file)
  },
  revisionData(file, revisionId) {
    return db.revisionData(file, revisionId)
  },
  getDraft() {
    return Promise.resolve(undefined)
  },
  storeDraft() {
    return Promise.resolve()
  },
  prepareUpload(file) {
    return db.prepareUpload(file)
  }
}

const dashboard = new Dashboard(
  db,
  cms.config,
  db.index,
  fixtureConnection,
  views
)

interface ExplorerTableStoryProps {
  explorer: DashboardExplorer
}

function ExplorerTableStory({explorer}: ExplorerTableStoryProps) {
  const items = useAtomValue(explorer.items)
  const {dragAndDropHooks} = useDragAndDrop<DashboardEntry>({})
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
