import {Button, Surface, SurfaceContent, SurfaceHeader} from '#/components.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {AlineaLogo} from './AlineaLogo.js'
import {Badge} from './Badge.js'
import {LogoShape} from './LogoShape.js'
import type {
  Dashboard,
  DashboardWorkspace,
  DashboardWorkspaceChange
} from '../store/Dashboard.js'
import css from './WorkspaceOverview.module.css'

const styles = styler(css)

interface WorkspaceOverviewProps {
  dashboard: Dashboard
}

export function WorkspaceOverview({dashboard}: WorkspaceOverviewProps) {
  const workspaces = useAtomValue(dashboard.workspaces)
  return (
    <div className={styles.WorkspaceOverview()}>
      <div className={styles.WorkspaceOverview.content()}>
        <div className={styles.WorkspaceOverview.list()}>
          {workspaces.map(key => (
            <WorkspaceOverviewCard
              key={key}
              workspace={dashboard.workspace(key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface WorkspaceOverviewCardProps {
  workspace: DashboardWorkspace
}

function WorkspaceOverviewCard({workspace}: WorkspaceOverviewCardProps) {
  const color = useAtomValue(workspace.color)
  const icon = useAtomValue(workspace.icon)
  const label = useAtomValue(workspace.label)
  const setRoute = useSetAtom(workspace.dashboard.route)

  function openWorkspace() {
    void setRoute({page: 'entry', workspace: workspace.key})
  }

  return (
    <Surface className={styles.WorkspaceOverview.card()}>
      <SurfaceHeader className={styles.WorkspaceOverview.card.header()}>
        <LogoShape
          background={color}
          icon={icon ?? AlineaLogo}
          className={styles.WorkspaceOverview.card.logo()}
        />
        <h2 className={styles.WorkspaceOverview.card.title()}>{label}</h2>
        <Button
          appearance="outline"
          className={styles.WorkspaceOverview.card.open()}
          onPress={openWorkspace}
        >
          Open workspace
        </Button>
      </SurfaceHeader>
      <Suspense fallback={<WorkspaceOverviewChangesLoading />}>
        <WorkspaceOverviewChanges workspace={workspace} />
      </Suspense>
    </Surface>
  )
}

interface WorkspaceOverviewChangesProps {
  workspace: DashboardWorkspace
}

function WorkspaceOverviewChanges({workspace}: WorkspaceOverviewChangesProps) {
  const changes = useAtomValue(workspace.latestChanges)
  return (
      <SurfaceContent className={styles.WorkspaceOverview.card.content()}>
        {changes.length === 0 ? (
          <p className={styles.WorkspaceOverview.empty()}>
            No changes yet.
          </p>
        ) : (
          <div className={styles.WorkspaceOverview.changes()}>
            {changes.map(change => (
              <WorkspaceChangeItem
                change={change}
                key={change.id}
                workspace={workspace}
              />
            ))}
          </div>
        )}
      </SurfaceContent>
  )
}

function WorkspaceOverviewChangesLoading() {
  return (
    <SurfaceContent className={styles.WorkspaceOverview.card.content()}>
      <p className={styles.WorkspaceOverview.empty()}>Loading changes…</p>
    </SurfaceContent>
  )
}

interface WorkspaceChangeItemProps {
  change: DashboardWorkspaceChange
  workspace: DashboardWorkspace
}

function WorkspaceChangeItem({
  change,
  workspace
}: WorkspaceChangeItemProps) {
  const setRoute = useSetAtom(workspace.dashboard.route)

  function openEntry() {
    void setRoute({
      entry: change.id,
      locale: change.locale ?? undefined,
      page: 'entry',
      root: change.root,
      workspace: workspace.key
    })
  }

  return (
    <Button
      appearance="plain"
      aria-label={`Open ${change.title}`}
      className={styles.WorkspaceOverview.change()}
      onPress={openEntry}
    >
      <time className={styles.WorkspaceOverview.change.time()}>
        {formatTimestamp(change.timestamp)}
      </time>
      <Badge
        className={styles.WorkspaceOverview.change.status()}
        status={change.status}
      >
        {formatStatus(change.status)}
      </Badge>
      <span className={styles.WorkspaceOverview.change.title()}>{change.title}</span>
      <span className={styles.WorkspaceOverview.change.user()}>
        {change.updatedBy}
      </span>
      <span className={styles.WorkspaceOverview.change.locale()}>
        {change.locale}
      </span>
    </Button>
  )
}

function formatStatus(status: DashboardWorkspaceChange['status']) {
  return status[0].toUpperCase() + status.slice(1)
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  const day = date.toLocaleDateString('nl-BE')
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${day} - ${time}`
}
