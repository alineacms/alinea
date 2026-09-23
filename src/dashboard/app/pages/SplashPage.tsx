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
      const entries = recentEntries.map(entry => {
        const type = config.schema[entry.type]
        return {
          ...entry,
          icon: type ? (getType(type).icon ?? LucideFile) : LucideFile
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
              <Text>Appearance</Text>
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
          className={styles.SplashPage.card.header.title()}
        >
          <Button
            variant="ghost"
            className={styles.SplashPage.card.header.button()}
            onClick={() => setRoute(openRoute)}
          >
            <WorkspaceAvatar color={workspace.color} icon={workspace.icon} />
            <span className={styles.SplashPage.card.header.content()}>
              <span className={styles.SplashPage.card.header.label()}>
                {workspace.label}
              </span>
            </span>
          </Button>
        </Heading>
        <div className={styles.SplashPage.card.footer()}>
          {visibleRoots.map(root => (
            <Button
              key={root.key}
              variant="ghost"
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
                className={styles.SplashPage.root()}
              >
                +{remainingRoots.length} more
              </DropdownMenuTrigger>
              <DropdownMenuContent
                aria-label={`More roots in ${workspace.label}`}
                side="bottom"
                align="start"
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
              <span className={styles.SplashPage.entry.content()}>
                <span className={styles.SplashPage.entry.primary()}>
                  <span className={styles.SplashPage.entry.visual()}>
                    <Icon
                      className={styles.SplashPage.entry.visual.icon()}
                      icon={entry.icon}
                    />
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
                  <Timestamp date={entry.changedAt} format="relative" />
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </Surface>
  )
}
