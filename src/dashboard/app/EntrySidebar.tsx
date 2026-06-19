import {
  Button,
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  ProgressCircle,
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {MetadataField, type Metadata} from '#/field/metadata.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue} from 'jotai'
import {Suspense, useState, type ComponentType, type ReactNode} from 'react'
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
    : ['preview', 'history', 'references']
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
                <Tab id="preview">Preview</Tab>
                <Tab id="history">History</Tab>
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
                <Suspense fallback={<EntrySidebarHistoryLoading />}>
                  <EntrySidebarHistory entry={entry} />
                </Suspense>
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
    <section className={styles.EntrySidebar.Versions()}>
      <ul className={styles.EntrySidebar.Versions.Timeline()}>
        {history.map(revision => EntrySidebarTimelineElement(revision))}
      </ul>
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
    </section>
  )
}

function EntrySidebarTimelineElement(revision: Revision) {
  const status = getRevisionKind(revision).status
  return (
    <li
      key={`${revision.file}:${revision.ref}-line`}
      className={styles.Timeline.element()}
    >
      <span className={styles.Timeline.element.outerCircle()}>
        <span
          className={styles.Timeline.element.innerCircle()}
          data-status={status}
        />
      </span>
      <span className={styles.Timeline.element.trail()} />
    </li>
  )
}

interface EntrySidebarStatusItemProps {
  entry: DashboardEntryData
  status: EntryStatus
}

function EntrySidebarStatusItem({entry, status}: EntrySidebarStatusItemProps) {
  const type = useAtomValue(entry.type)
  const sourceLocale = useAtomValue(entry.sourceLocale)
  const versions = useAtomValue(entry.languages(sourceLocale).versions)
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = useAtomValue(entry.activeVersion)
  const currentlyEditing = useAtomValue(entry.currentlyEditing)
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  const isEditing = activeStatus === status && currentlyEditing !== undefined
  const selected =
    selectedVersion.type === 'status' && selectedVersion.status === status
  const rowStatus = getStatusItemVersionStatus(status, activeVersion?.main)
  const version = versions.get(status)
  const hasMetadata = Type.field(type.type, 'metadata') instanceof MetadataField
  const meta = hasMetadata ? formatMetadata(version?.data.metadata) : undefined
  return (
    <li className={styles.EntrySidebar.historyItem()}>
      <EntrySidebarVersionRow
        selected={selected}
        status={rowStatus}
        icon={getVersionStatusIcon(rowStatus)}
        title={formatStatus(status)}
        meta={meta}
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
        // title={revision.description ?? 'Page published'}
        // meta={formatMeta(revision)}
        title={formatTime(revision.createdAt)}
        meta={revision?.user?.name}
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

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) {
    return 'Invalid Date'
  }
  const ddmmyyyy = date.toLocaleDateString('nl-BE')
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${ddmmyyyy} - ${time}`
}

function formatMetadata(metadata: unknown) {
  if (!isMetadata(metadata) || typeof metadata.updatedAt !== 'number') {
    return undefined
  }
  const updatedAt = formatTime(metadata.updatedAt * 1000)
  const updatedBy = metadata.updatedBy.name
  return updatedBy ? `${updatedBy} ${updatedAt}` : updatedAt
}

function isMetadata(value: unknown): value is Metadata {
  if (!isRecord(value)) return false
  const updatedBy = value.updatedBy
  return (
    (typeof value.updatedAt === 'number' || value.updatedAt === null) &&
    isRecord(updatedBy) &&
    typeof updatedBy.name === 'string' &&
    typeof updatedBy.email === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
