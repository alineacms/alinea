import {
  Button,
  Disclosure,
  Icon,
  ProgressCircle,
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {EntryStatus} from '#/core/Entry.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {useState, type ComponentType} from 'react'
import {
  IcOutlineDrafts,
  IcRoundEdit,
  IcRoundHistory,
  IcRoundPublishedWithChanges,
  IcRoundVisibility
} from '../icons.js'
import {DashboardEntry} from '../store.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
import {Sidebar, SidebarBody, SidebarHeader} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: DashboardEntry
}

export function EntrySidebar({entry}: EntrySidebarProps) {
  return (
    <Sidebar>
      <Tabs
        defaultSelectedKey="history"
        variant="subtle"
        className={styles.EntrySidebar.tabs()}
      >
        <SidebarHeader>
          <TabList aria-label="Entry sidebar">
            <Tab id="history">
              <Icon icon={IcRoundHistory} />
              History
            </Tab>
            <Tab id="preview">
              <Icon icon={IcRoundVisibility} />
              Preview
            </Tab>
          </TabList>
        </SidebarHeader>

        <SidebarBody className={styles.EntrySidebar.body()}>
          <TabPanel id="history" className={styles.EntrySidebar.historyPanel()}>
            <EntrySidebarHistory entry={entry} />
          </TabPanel>
          <TabPanel id="preview" className={styles.EntrySidebar.previewPanel()}>
            <EntrySidebarPreview entry={entry} />
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}

interface EntrySidebarHistoryProps {
  entry: DashboardEntry
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
          title="Previous versions"
          onExpandedChange={setPreviousVersionsOpen}
        >
          {previousVersionsOpen && (
            <EntrySidebarPreviousVersions entry={entry} />
          )}
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
  entry: DashboardEntry
  status: EntryStatus
  currentRevision?: Revision
}

function EntrySidebarStatusItem({
  entry,
  status,
  currentRevision
}: EntrySidebarStatusItemProps) {
  const activeStatus = useAtomValue(entry.activeStatus)
  const currentlyEditing = useAtomValue(entry.currentlyEditing)
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  const isEditing = activeStatus === status && currentlyEditing !== undefined
  const selected =
    selectedVersion.type === 'status' && selectedVersion.status === status
  return (
    <li className={styles.EntrySidebar.historyItem()}>
      <Button
        appearance={selected ? 'active' : 'outline'}
        intent="secondary"
        className={styles.EntrySidebar.versionButton({
          selected,
          status
        })}
        onPress={() => setSelectedVersion({type: 'status', status})}
      >
        <EntrySidebarHistoryIcon
          icon={status === 'published' ? IcRoundVisibility : IcRoundEdit}
        />
        <span className={styles.EntrySidebar.versionContent()}>
          <span className={styles.EntrySidebar.versionTitle()}>
            {formatStatus(status)}
          </span>
          <span className={styles.EntrySidebar.versionMeta()}>
            {formatMeta(currentRevision)}
          </span>
        </span>
        {isEditing && (
          <span className={styles.EntrySidebar.historyBadge()}>Editing</span>
        )}
      </Button>
    </li>
  )
}

interface EntrySidebarRevisionItemProps {
  entry: DashboardEntry
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
  return (
    <li className={styles.EntrySidebar.historyItem()}>
      <Button
        appearance={selected ? 'active' : 'outline'}
        intent="secondary"
        className={styles.EntrySidebar.revisionButton({selected})}
        onPress={() =>
          setSelectedVersion({
            type: 'history',
            file: revision.file,
            ref: revision.ref
          })
        }
      >
        <EntrySidebarHistoryIcon
          icon={isLatest ? IcRoundPublishedWithChanges : IcOutlineDrafts}
        />
        <span className={styles.EntrySidebar.versionContent()}>
          <span className={styles.EntrySidebar.versionTitle()}>
            {revision.description ?? 'Page published'}
          </span>
          <span className={styles.EntrySidebar.versionMeta()}>
            {formatMeta(revision)}
          </span>
        </span>
      </Button>
    </li>
  )
}

interface EntrySidebarHistoryIconProps {
  icon: ComponentType
}

function EntrySidebarHistoryIcon({icon}: EntrySidebarHistoryIconProps) {
  return (
    <span className={styles.EntrySidebar.historyIcon()}>
      <Icon icon={icon} />
    </span>
  )
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
  const user = revision?.user?.name ?? 'Local user'
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
