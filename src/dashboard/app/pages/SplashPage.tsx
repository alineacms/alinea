import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Heading,
  Icon,
  Surface,
  Text,
  Timestamp
} from '#/components.js'
import {Entry, type EntryAuditUser} from '#/core/Entry.js'
import {timestampFromId} from '#/core/Id.js'
import {getRoot, getType} from '#/core/Internal.js'
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
import {fileKindVisual} from '../FileKind.js'
import {searchShortcutKeys} from '../../hook/UseSearchShortcut.js'
import {GlobalSearch, WorkspaceAvatar} from '../WorkspaceMenu.js'
import css from './SplashPage.module.css'

const styles = styler(css)
const recentEntryCount = 3
const recentCandidateWindowSize = recentEntryCount
const visibleRootCount = 2
const futureTimestampTolerance = 24 * 60 * 60 * 1000

export interface RecentChangeAudit {
  createdAt: number | null
  createdBy: EntryAuditUser | null
  updatedAt: number | null
  updatedBy: EntryAuditUser | null
}

export interface RecentChange {
  action?: 'Created' | 'Edited'
  actor?: string
  /** Milliseconds since the epoch */
  changedAt?: number
}

interface RecentEntryRow extends RecentChangeAudit {
  id: string
  /** The extension of a media file */
  extension: string | null
  locale: string | null
  root: string
  title: string
  type: string
  workspace: string
}

interface RecentEntryCandidate extends RecentEntryRow, RecentChange {
  changedAt: number
}

interface RecentEntry extends RecentEntryCandidate {
  icon: ComponentType
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
          const {label} = getRoot(root)
          const icon = get(rootAtoms(key, rootKey).icon)
          return [{icon, key: rootKey, label}]
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
            orderBy: {desc: Entry.id},
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
            toRecentEntry(entry, trustsIdTimestamps, now)
          ])
        ).values()
      )
        .filter((entry): entry is RecentEntryCandidate => Boolean(entry))
        .sort((a, b) => b.changedAt - a.changedAt)
        .slice(0, recentEntryCount)
      const entries = recentEntries.map(entry => {
        const type = config.schema[entry.type]
        return {
          ...entry,
          icon:
            type === MediaFile
              ? fileKindVisual(entry.extension).icon
              : type
                ? (getType(type).icon ?? LucideFile)
                : LucideFile
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
  createdAt: Entry.createdAt,
  createdBy: Entry.createdBy,
  extension: MediaFile.extension,
  id: Entry.id,
  locale: Entry.locale,
  root: Entry.root,
  title: Entry.title,
  type: Entry.type,
  updatedAt: Entry.updatedAt,
  updatedBy: Entry.updatedBy,
  workspace: Entry.workspace
}

/**
 * The last change recorded in the audit metadata of an entry or media file:
 * an update after the creation is an edit, a creation that was not updated
 * since is the creation
 */
export function recentChange({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy
}: RecentChangeAudit): RecentChange {
  const created = typeof createdAt === 'number'
  if (typeof updatedAt === 'number' && !(created && updatedAt <= createdAt))
    return {
      action: 'Edited',
      actor: auditName(updatedBy),
      changedAt: updatedAt * 1000
    }
  if (created)
    return {
      action: 'Created',
      actor: auditName(createdBy) ?? auditName(updatedBy),
      changedAt: createdAt * 1000
    }
  return {actor: auditName(updatedBy) ?? auditName(createdBy)}
}

function auditName(user: EntryAuditUser | null) {
  return user?.name || user?.email || undefined
}

function toRecentEntry(
  entry: RecentEntryRow,
  trustsIdTimestamps: boolean,
  now: number
): RecentEntryCandidate | undefined {
  const change = recentChange(entry)
  const changedAt =
    change.changedAt ??
    (trustsIdTimestamps ? timestampFromId(entry.id) : undefined)
  // Like ids, audit times far in the future were not made by this clock
  if (changedAt === undefined || changedAt > now + futureTimestampTolerance)
    return undefined
  return {...entry, ...change, changedAt}
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
                  className={styles.SplashPage.user.icon()}
                />
                <Text weight="medium" truncate>
                  {userName}
                </Text>
              </div>
            )}
            {searchRoot && (
              <GlobalSearch initialSearchScope="everything" root={searchRoot}>
                <Button
                  variant="ghost"
                  icon={IcRoundSearch}
                  className={styles.SplashPage.action()}
                  aria-label="Search content"
                  aria-keyshortcuts={searchShortcutKeys}
                >
                  <Text truncate>Search content</Text>
                </Button>
              </GlobalSearch>
            )}
            {canManageMembers && (
              <Button
                variant="ghost"
                icon={IcOutlineSettings}
                className={styles.SplashPage.action()}
                onClick={() => setRoute({page: 'users'})}
              >
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
        <Heading
          as="h2"
          size="xs"
          weight="medium"
          className={styles.SplashPage.card.header.title()}
        >
          <Button
            variant="ghost"
            className={styles.SplashPage.workspace()}
            onClick={() => setRoute(openRoute)}
          >
            <WorkspaceAvatar
              color={workspace.color}
              icon={workspace.icon}
              label={workspace.label}
            />
            <span className={styles.SplashPage.workspace.label()}>
              {workspace.label}
            </span>
          </Button>
        </Heading>
        <div className={styles.SplashPage.roots()}>
          {visibleRoots.map(root => (
            <Button
              key={root.key}
              variant="ghost"
              size="sm"
              className={styles.SplashPage.root()}
              icon={root.icon}
              onClick={() => setRoute({workspace: key, root: root.key})}
            >
              {root.label}
            </Button>
          ))}
          {remainingRoots.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                variant="ghost"
                size="sm"
                className={styles.SplashPage.root()}
              >
                +{remainingRoots.length} more
              </DropdownMenuTrigger>
              <DropdownMenuContent
                aria-label={`More roots in ${workspace.label}`}
                side="bottom"
                align="end"
              >
                {remainingRoots.map(root => (
                  <DropdownMenuItem
                    key={root.key}
                    icon={root.icon}
                    textValue={root.label}
                    onSelect={() => setRoute({workspace: key, root: root.key})}
                  >
                    {root.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      {entries.length > 0 && (
        <div className={styles.SplashPage.entries()}>
          {entries.map(entry => (
            <Button
              key={entry.id}
              variant="ghost"
              className={styles.SplashPage.entry()}
              onClick={() =>
                setRoute({
                  workspace: entry.workspace,
                  root: entry.root,
                  entry: entry.id,
                  locale: entry.locale ?? undefined,
                  view: 'edit'
                })
              }
            >
              <span className={styles.SplashPage.entry.visual()}>
                <Icon icon={entry.icon} />
              </span>
              <span className={styles.SplashPage.entry.content()}>
                <span
                  className={styles.SplashPage.entry.title()}
                  title={entry.title}
                >
                  {entry.title}
                </span>
                <span className={styles.SplashPage.entry.meta()}>
                  {entry.action && <span>{entry.action}</span>}
                  {entry.action && <span aria-hidden="true">·</span>}
                  <Timestamp date={entry.changedAt} format="relative" />
                  {entry.actor && <span aria-hidden="true">·</span>}
                  {entry.actor && (
                    <span className={styles.SplashPage.entry.user()}>
                      {entry.actor}
                    </span>
                  )}
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </Surface>
  )
}
