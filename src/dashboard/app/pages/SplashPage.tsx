import {Button, Icon, Menu, MenuItem, Surface} from '#/components.js'
import {Entry, type EntryAuditUser} from '#/core/Entry.js'
import {timestampFromId} from '#/core/Id.js'
import {getRoot, getType} from '#/core/Internal.js'
import {isImage} from '#/core/media/IsImage.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {configAtom, graphAtom} from '#/dashboard/atoms/core.js'
import {shaAtom} from '#/dashboard/atoms/graph.js'
import {routeAtom, type DashboardRoute} from '#/dashboard/atoms/nav.js'
import {rootAtoms, type RootAtoms} from '#/dashboard/atoms/root.js'
import {workspaceAtom, workspacesAtom} from '#/dashboard/atoms/config.js'
import {canManageMembersAtom, policyAtom} from '#/dashboard/atoms/user.js'
import {useUser} from '#/dashboard/hooks.js'
import {styler} from '@alinea/styler'
import {useSetAtom, type Getter} from 'jotai'
import type {ComponentType, MouseEvent, ReactNode} from 'react'
import {
  IcBaselineAccountCircle,
  IcOutlineSettings,
  IcRoundSearch,
  LucideFile
} from '../../icons.js'
import {AppearanceToggle} from '../AppearanceToggle.js'
import {GlobalSearch, WorkspaceAvatar} from '../WorkspaceMenu.js'
import css from './SplashPage.module.css'

const styles = styler(css)
const recentEntryCount = 3
const recentCandidateWindowSize = recentEntryCount
const visibleRootCount = 2
const futureTimestampTolerance = 24 * 60 * 60 * 1000
const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'narrow'
})
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short'
})
const changedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

interface RecentEntryCandidate {
  actor?: string
  changedAt: number
  createdBy: EntryAuditUser | null
  id: string
  locale: string | null
  root: string
  title: string
  type: string
  updatedAt: number | null
  updatedBy: EntryAuditUser | null
  workspace: string
}

interface RecentEntry extends RecentEntryCandidate {
  averageColor?: string
  icon: ComponentType
  preview?: string
}

interface WorkspaceSummary {
  entries: Array<RecentEntry>
  key: string
  openRoute: DashboardRoute
  roots: Array<WorkspaceRootSummary>
  workspace: WorkspaceInternal
}

interface WorkspaceRootSummary {
  icon: ComponentType
  key: string
  label: string
}

export async function splashPage(get: Getter): Promise<ReactNode> {
  const canManageMembers = await get(canManageMembersAtom)
  await get(shaAtom)
  const graph = get(graphAtom)
  const config = get(configAtom)
  const policy = get(policyAtom)
  const summaries = await Promise.all(
    get(workspacesAtom).map(async key => {
      const workspace = get(workspaceAtom(key))
      const roots = Object.entries(workspace.roots).flatMap(
        ([rootKey, root]) => {
          if (!policy.canRead({workspace: key, root: rootKey})) return []
          const {icon, label} = getRoot(root)
          return [{icon: icon ?? LucideFile, key: rootKey, label}]
        }
      )
      const candidates = await Promise.all(
        roots.flatMap(({key: root}) => [
          graph.find({
            workspace: key,
            root,
            status: 'preferDraft',
            groupBy: Entry.id,
            orderBy: {desc: Entry.updatedAt},
            take: recentCandidateWindowSize,
            select: recentEntrySelection
          }),
          graph.find({
            workspace: key,
            root,
            status: 'preferDraft',
            groupBy: Entry.id,
            orderBy: {desc: Entry.id, caseSensitive: true},
            take: recentCandidateWindowSize,
            select: recentEntrySelection
          })
        ])
      )
      const readableCandidates = candidates
        .flat()
        .filter(entry => policy.canRead(entry))
      const now = Date.now()
      const trustsIdTimestamps = readableCandidates.every(entry => {
        const timestamp = timestampFromId(entry.id)
        return (
          timestamp === undefined || timestamp <= now + futureTimestampTolerance
        )
      })
      const recentEntries = Array.from(
        new Map(
          readableCandidates.map(entry => [
            entry.id,
            toRecentEntry(entry, trustsIdTimestamps)
          ])
        ).values()
      )
        .filter((entry): entry is RecentEntryCandidate => Boolean(entry))
        .sort((a, b) => b.changedAt - a.changedAt)
        .slice(0, recentEntryCount)
      const mediaIds = recentEntries
        .filter(entry => entry.type === 'MediaFile')
        .map(entry => entry.id)
      const mediaEntries = mediaIds.length
        ? await graph.find({
            id: {in: mediaIds},
            status: 'preferDraft',
            groupBy: Entry.id,
            select: {
              averageColor: MediaFile.averageColor,
              extension: MediaFile.extension,
              id: Entry.id,
              preview: MediaFile.preview
            }
          })
        : []
      const mediaById = new Map(mediaEntries.map(entry => [entry.id, entry]))
      const entries = recentEntries.map(entry => {
        const media = mediaById.get(entry.id)
        const type = config.schema[entry.type]
        const preview =
          media?.preview && isImage(media.extension) ? media.preview : undefined
        return {
          ...entry,
          averageColor: media?.averageColor,
          icon: type ? (getType(type).icon ?? LucideFile) : LucideFile,
          preview
        }
      })
      return {
        entries,
        key,
        openRoute: {workspace: key, root: roots[0]?.key},
        roots,
        workspace
      }
    })
  )
  const searchLocation = summaries
    .flatMap(summary =>
      summary.roots.map(root => ({root: root.key, workspace: summary.key}))
    )
    .at(0)
  const searchRoot = searchLocation
    ? rootAtoms(searchLocation.workspace, searchLocation.root)
    : undefined
  return (
    <SplashPage
      canManageMembers={canManageMembers}
      searchRoot={searchRoot}
      summaries={summaries}
    />
  )
}

const recentEntrySelection = {
  createdBy: Entry.createdBy,
  id: Entry.id,
  locale: Entry.locale,
  root: Entry.root,
  title: Entry.title,
  type: Entry.type,
  updatedAt: Entry.updatedAt,
  updatedBy: Entry.updatedBy,
  workspace: Entry.workspace
}

function toRecentEntry(
  entry: Omit<RecentEntryCandidate, 'actor' | 'changedAt'>,
  trustsIdTimestamps: boolean
): RecentEntryCandidate | undefined {
  const changedAt =
    typeof entry.updatedAt === 'number'
      ? entry.updatedAt * 1000
      : trustsIdTimestamps
        ? timestampFromId(entry.id)
        : undefined
  if (changedAt === undefined) return undefined
  const auditUser = entry.updatedBy ?? entry.createdBy
  const actor = auditUser?.name || auditUser?.email || undefined
  return {...entry, actor, changedAt}
}

interface SplashPageProps {
  canManageMembers: boolean
  searchRoot?: RootAtoms
  summaries: Array<WorkspaceSummary>
}

function SplashPage({
  canManageMembers,
  searchRoot,
  summaries
}: SplashPageProps) {
  const user = useUser()
  const setRoute = useSetAtom(routeAtom)
  const userName = user ? (user.name ?? user.sub) : undefined
  return (
    <main className={styles.SplashPage()}>
      <div className={styles.SplashPage.content()}>
        <aside
          aria-label="Dashboard tools"
          className={styles.SplashPage.sidebar()}
        >
          <div className={styles.SplashPage.sidebar.content()}>
            {userName && (
              <div className={styles.SplashPage.user()}>
                <Icon
                  icon={IcBaselineAccountCircle}
                  className={styles.SplashPage.actionIcon()}
                />
                <span className={styles.SplashPage.user.label()}>
                  {userName}
                </span>
              </div>
            )}
            {searchRoot && (
              <GlobalSearch initialSearchScope="everything" root={searchRoot}>
                <Button
                  appearance="plain"
                  className={styles.SplashPage.action()}
                  aria-label="Search content"
                >
                  <Icon
                    icon={IcRoundSearch}
                    className={styles.SplashPage.actionIcon()}
                  />
                  <span className={styles.SplashPage.search.label()}>
                    Search content
                  </span>
                </Button>
              </GlobalSearch>
            )}
            {canManageMembers && (
              <Button
                appearance="plain"
                className={styles.SplashPage.action()}
                onPress={() => setRoute({page: 'users'})}
              >
                <Icon
                  icon={IcOutlineSettings}
                  className={styles.SplashPage.actionIcon()}
                />
                Manage users
              </Button>
            )}
            <div
              aria-label="Appearance"
              className={styles.SplashPage.appearance()}
            >
              <span className={styles.SplashPage.appearance.label()}>
                Appearance
              </span>
              <AppearanceToggle />
            </div>
          </div>
        </aside>
        <div className={styles.SplashPage.grid()}>
          {summaries.map(summary => (
            <WorkspaceCard key={summary.key} summary={summary} />
          ))}
        </div>
      </div>
    </main>
  )
}

interface WorkspaceCardProps {
  summary: WorkspaceSummary
}

function WorkspaceCard({summary}: WorkspaceCardProps) {
  const setRoute = useSetAtom(routeAtom)
  const {entries, key, openRoute, roots, workspace} = summary
  const visibleRoots = roots.slice(0, visibleRootCount)
  const remainingRoots = roots.slice(visibleRootCount)
  function onCardClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('a, button, [role="menuitem"]')
    )
      return
    setRoute(openRoute)
  }
  return (
    <Surface className={styles.SplashPage.card()} onClick={onCardClick}>
      <header className={styles.SplashPage.card.header()}>
        <h2 className={styles.SplashPage.card.header.title()}>
          <Button
            appearance="plain"
            className={styles.SplashPage.card.header.button()}
            onPress={() => setRoute(openRoute)}
          >
            <WorkspaceAvatar color={workspace.color} icon={workspace.icon} />
            <span className={styles.SplashPage.card.header.content()}>
              <span className={styles.SplashPage.card.header.label()}>
                {workspace.label}
              </span>
            </span>
          </Button>
        </h2>
        <div className={styles.SplashPage.card.footer()}>
          {visibleRoots.map(root => (
            <Button
              key={root.key}
              appearance="plain"
              className={styles.SplashPage.root()}
              icon={root.icon}
              onPress={() => setRoute({workspace: key, root: root.key})}
            >
              {root.label}
            </Button>
          ))}
          {remainingRoots.length > 0 && (
            <Menu
              aria-label={`More roots in ${workspace.label}`}
              onAction={rootKey =>
                setRoute({workspace: key, root: String(rootKey)})
              }
              popoverProps={{placement: 'bottom start'}}
              label={
                <Button appearance="plain" className={styles.SplashPage.root()}>
                  +{remainingRoots.length} more
                </Button>
              }
            >
              {remainingRoots.map(root => (
                <MenuItem key={root.key} id={root.key} textValue={root.label}>
                  <Icon
                    icon={root.icon}
                    className={styles.SplashPage.root.menuIcon()}
                  />
                  {root.label}
                </MenuItem>
              ))}
            </Menu>
          )}
        </div>
      </header>
      {entries.length > 0 && (
        <div className={styles.SplashPage.entries()}>
          {entries.map(entry => (
            <Button
              key={entry.id}
              appearance="plain"
              className={styles.SplashPage.entry()}
              onPress={() =>
                setRoute({
                  workspace: entry.workspace,
                  root: entry.root,
                  entry: entry.id,
                  locale: entry.locale ?? undefined,
                  view: 'edit'
                })
              }
            >
              <span className={styles.SplashPage.entry.content()}>
                <span className={styles.SplashPage.entry.primary()}>
                  <span
                    className={styles.SplashPage.entry.visual()}
                    style={{backgroundColor: entry.averageColor}}
                  >
                    {entry.preview ? (
                      <img
                        alt=""
                        className={styles.SplashPage.entry.visual.image()}
                        src={entry.preview}
                      />
                    ) : (
                      <Icon
                        className={styles.SplashPage.entry.visual.icon()}
                        icon={entry.icon}
                      />
                    )}
                  </span>
                  <span className={styles.SplashPage.entry.title()}>
                    <span title={entry.title}>{entry.title}</span>
                  </span>
                </span>
                <span className={styles.SplashPage.entry.meta()}>
                  {entry.actor && (
                    <span className={styles.SplashPage.entry.user()}>
                      {entry.actor}
                    </span>
                  )}
                  {entry.actor && <span aria-hidden="true">·</span>}
                  <time
                    className={styles.SplashPage.entry.time()}
                    dateTime={new Date(entry.changedAt).toISOString()}
                    title={formatChangedAt(entry.changedAt)}
                  >
                    {formatRelativeTime(entry.changedAt)}
                  </time>
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </Surface>
  )
}

function formatChangedAt(timestamp: number) {
  return changedAtFormatter.format(timestamp)
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  if (Math.abs(seconds) < 60)
    return relativeTimeFormatter.format(seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60)
    return relativeTimeFormatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relativeTimeFormatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return relativeTimeFormatter.format(days, 'day')
  return shortDateFormatter.format(timestamp)
}
