import {
  Button,
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  Icon,
  ProgressCircle,
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {useState, type ComponentType, type ReactNode} from 'react'
import {
  IcOutlineDrafts,
  IcRoundArchive,
  IcRoundEdit,
  IcRoundPublishedWithChanges,
  IcRoundVisibility,
  IcRoundVisibilityOff
} from '../icons.js'
import type {DashboardEntryData, DashboardEntrySidebarTab} from '../store.js'
import {Badge} from './Badge.js'
import {EntryReferences} from './EntryReferences.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {RailHeader} from './ui/Rail.js'
import {Sidebar, SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: DashboardEntryData
  onOpenChange?: (isOpen: boolean) => void
}

export function EntrySidebar({entry, onOpenChange}: EntrySidebarProps) {
  const type = useAtomValue(entry.type)
  const [selectedTab, setSelectedTab] = useAtom(entry.dashboard.entrySidebarTab)
  const isMediaFile = type.type === MediaFile
  const allowedTabs: Array<DashboardEntrySidebarTab> = isMediaFile
    ? ['references']
    : ['history', 'preview', 'references']
  const selectedKey = allowedTabs.includes(selectedTab)
    ? selectedTab
    : allowedTabs[0]
  return (
    <Sidebar>
      <Tabs
        className={styles.EntrySidebar.tabs()}
        selectedKey={selectedKey}
        onSelectionChange={key => {
          if (isMediaFile) return
          const next = key as DashboardEntrySidebarTab
          if (allowedTabs.includes(next)) {
            setSelectedTab(next)
          }
        }}
      >
        <RailHeader className={styles.EntrySidebar.header()}>
          <TabList aria-label="Entry sidebar">
            {!isMediaFile && (
              <>
                <Tab id="history">History</Tab>
                <Tab id="preview">Preview</Tab>
              </>
            )}
            <Tab id="references">References</Tab>
          </TabList>
          {onOpenChange && (
            <EntrySidebarToggle isOpen={true} onOpenChange={onOpenChange} />
          )}
        </RailHeader>

        <SidebarBody className={styles.EntrySidebar.body()}>
          {!isMediaFile && (
            <>
              <TabPanel
                id="history"
                className={styles.EntrySidebar.historyPanel()}
              >
                <EntrySidebarHistory entry={entry} />
              </TabPanel>
              <TabPanel
                id="preview"
                className={styles.EntrySidebar.previewPanel()}
              >
                <EntrySidebarPreview entry={entry} />
              </TabPanel>
            </>
          )}
          <TabPanel
            id="references"
            className={styles.EntrySidebar.referencesPanel()}
          >
            <EntryReferences entry={entry} />
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}

interface EntrySidebarHistoryProps {
  entry: DashboardEntryData
}

function EntrySidebarHistory({entry}: EntrySidebarHistoryProps) {
  const statuses = useAtomValue(entry.availableStatuses)
  const [previousVersionsOpen, setPreviousVersionsOpen] = useState(false)
  return (
    <div className={styles.EntrySidebar.history()}>
      <section className={styles.EntrySidebar.section()}>
        <h2 className={styles.EntrySidebar.sectionTitle()}>Current versions</h2>
        <ul className={styles.EntrySidebar.historyList()}>
          {statuses.map(status => (
            <EntrySidebarStatusItem
              key={status}
              entry={entry}
              status={status}
            />
          ))}
        </ul>
      </section>
      <section className={styles.EntrySidebar.section()}>
        <Disclosure
          key={entry.id}
          className={styles.EntrySidebar.disclosure()}
          onExpandedChange={setPreviousVersionsOpen}
        >
          <DisclosureHeader>Previous versions</DisclosureHeader>
          <DisclosurePanel className={styles.EntrySidebar.disclosurePanel()}>
            {previousVersionsOpen && (
              <EntrySidebarPreviousVersions entry={entry} />
            )}
          </DisclosurePanel>
        </Disclosure>
      </section>
    </div>
  )
}

function EntrySidebarPreviousVersions({entry}: EntrySidebarHistoryProps) {
  const history = useAtomValue(entry.history)
  if (!history) return <EntrySidebarHistoryLoading />
  if (history.length === 0)
    return (
      <p className={styles.EntrySidebar.empty()}>No previous versions yet</p>
    )
  return (
    <ul className={styles.EntrySidebar.historyList()}>
      {history.map(revision => (
        <EntrySidebarRevisionItem
          key={`${revision.file}:${revision.ref}`}
          entry={entry}
          revision={revision}
          isLatest={false}
        />
      ))}
    </ul>
  )
}

interface EntrySidebarStatusItemProps {
  entry: DashboardEntryData
  status: EntryStatus
  currentRevision?: Revision
}

function EntrySidebarStatusItem({
  entry,
  status,
  currentRevision
}: EntrySidebarStatusItemProps) {
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = useAtomValue(entry.activeVersion)
  const currentlyEditing = useAtomValue(entry.currentlyEditing)
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  const isEditing = activeStatus === status && currentlyEditing !== undefined
  const selected =
    selectedVersion.type === 'status' && selectedVersion.status === status
  const rowStatus = getStatusItemVersionStatus(status, activeVersion?.main)
  return (
    <li className={styles.EntrySidebar.historyItem()}>
      <EntrySidebarVersionRow
        selected={selected}
        status={rowStatus}
        icon={getVersionStatusIcon(rowStatus)}
        title={formatStatus(status)}
        meta={formatMeta(currentRevision)}
        onPress={() => setSelectedVersion({type: 'status', status})}
      >
        {isEditing && (
          <Badge appearance="background" size="small">
            Editing
          </Badge>
        )}
      </EntrySidebarVersionRow>
    </li>
  )
}

interface EntrySidebarRevisionItemProps {
  entry: DashboardEntryData
  revision: Revision
  isLatest: boolean
}

function EntrySidebarRevisionItem({
  entry,
  revision,
  isLatest
}: EntrySidebarRevisionItemProps) {
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  const selected =
    selectedVersion.type === 'history' &&
    selectedVersion.ref === revision.ref &&
    selectedVersion.file === revision.file
  const revisionKind = getRevisionKind(revision)
  return (
    <li className={styles.EntrySidebar.historyItem()}>
      <EntrySidebarVersionRow
        selected={selected}
        status={revisionKind.status}
        icon={isLatest ? IcRoundPublishedWithChanges : revisionKind.icon}
        title={revision.description ?? 'Page published'}
        meta={formatMeta(revision)}
        onPress={() =>
          setSelectedVersion({
            type: 'history',
            file: revision.file,
            ref: revision.ref
          })
        }
      />
    </li>
  )
}

export type EntrySidebarVersionStatus = EntryStatus | 'unpublished' | 'none'

export interface EntrySidebarVersionRowProps {
  selected?: boolean
  status?: EntrySidebarVersionStatus
  icon: ComponentType
  title: ReactNode
  meta: ReactNode
  children?: ReactNode
  onPress?: () => void
}

export function EntrySidebarVersionRow({
  selected = false,
  status = 'none',
  icon,
  title,
  meta,
  children,
  onPress
}: EntrySidebarVersionRowProps) {
  return (
    <Button
      appearance="outline"
      className={styles.EntrySidebar.versionButton()}
      data-selected={selected || undefined}
      data-status={status}
      onPress={onPress}
    >
      <span className={styles.EntrySidebar.historyIcon()}>
        <Icon icon={icon} />
      </span>
      <span className={styles.EntrySidebar.versionContent()}>
        <span className={styles.EntrySidebar.versionTitle()}>{title}</span>
        <span className={styles.EntrySidebar.versionMeta()}>{meta}</span>
      </span>
      {children}
    </Button>
  )
}

interface EntrySidebarRevisionKind {
  icon: ComponentType
  status: EntrySidebarVersionStatus
}

function getStatusItemVersionStatus(
  status: EntryStatus,
  main?: boolean
): EntrySidebarVersionStatus {
  if (status === 'draft' && main === true) return 'unpublished'
  return status
}

function getVersionStatusIcon(status: EntrySidebarVersionStatus) {
  switch (status) {
    case 'published':
      return IcRoundVisibility
    case 'unpublished':
      return IcRoundVisibilityOff
    case 'archived':
      return IcRoundArchive
    default:
      return IcRoundEdit
  }
}

function getRevisionKind(revision: Revision): EntrySidebarRevisionKind {
  const description = revision.description?.toLowerCase() ?? ''
  if (description.includes('unpublish')) {
    return {icon: getVersionStatusIcon('unpublished'), status: 'unpublished'}
  }
  if (description.includes('archive')) {
    return {icon: getVersionStatusIcon('archived'), status: 'archived'}
  }
  if (description.includes('draft')) {
    return {icon: getVersionStatusIcon('draft'), status: 'draft'}
  }
  if (description.includes('publish')) {
    return {icon: getVersionStatusIcon('published'), status: 'published'}
  }
  return {icon: IcOutlineDrafts, status: 'none'}
}

function EntrySidebarHistoryLoading() {
  return (
    <div className={styles.EntrySidebar.loading()}>
      <ProgressCircle isIndeterminate aria-label="Loading history" />
    </div>
  )
}

function formatStatus(status: EntryStatus) {
  return status[0].toUpperCase() + status.slice(1)
}

function formatMeta(revision?: Revision) {
  const user = revision?.user?.name
  if (!revision) return user
  return `${user} - ${formatRelativeTime(revision.createdAt)}`
}

function formatRelativeTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime()
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  if (startOfDate === startOfToday) return `Today at ${time}`
  if (startOfDate === startOfToday - 24 * 60 * 60 * 1000)
    return `Yesterday at ${time}`
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
