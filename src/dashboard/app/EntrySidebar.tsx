import {
  Button,
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {MetadataField, type Metadata} from '#/field/metadata.js'
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
import type {EntryDataAtoms} from '../atoms/entry.js'
import {
  allowedEntrySidebarTabs,
  entrySidebarTabAtom,
  type EntrySidebarTab
} from '../atoms/entry/load.js'
import {type EntryPageData, type EntrySidebarData} from '../atoms/entry/load.js'
import {Badge} from './Badge.js'
import {EntryReferences} from './EntryReferences.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {RailHeader} from './ui/Rail.js'
import {Sidebar, SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: EntryDataAtoms
  page: EntryPageData
  onOpenChange?: (isOpen: boolean) => void
}

export function EntrySidebar({entry, page, onOpenChange}: EntrySidebarProps) {
  const type = useAtomValue(entry.type)
  const sidebar = page.sidebar.data
  const [, setSelectedTab] = useAtom(entrySidebarTabAtom)
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const hasPreview = !isMediaFile && !isMediaLibrary
  const allowedTabs = allowedEntrySidebarTabs(type)
  const selectedKey = allowedTabs.includes(page.sidebar.tab)
    ? page.sidebar.tab
    : allowedTabs[0]

  return (
    <Sidebar>
      <Tabs
        className={styles.EntrySidebar.tabs()}
        selectedKey={selectedKey}
        onSelectionChange={key => {
          if (isMediaFile) return
          const next = key as EntrySidebarTab
          if (allowedTabs.includes(next)) {
            setSelectedTab(next)
          }
        }}
      >
        <RailHeader className={styles.EntrySidebar.header()}>
          <TabList aria-label="Entry sidebar">
            {hasPreview ? (
              <>
                <Tab id="preview">Preview</Tab>
                <Tab id="history">History</Tab>
              </>
            ) : !isMediaFile ? (
              <Tab id="history">History</Tab>
            ) : null}
            <Tab id="references">References</Tab>
          </TabList>
          {onOpenChange && (
            <EntrySidebarToggle isOpen={true} onOpenChange={onOpenChange} />
          )}
        </RailHeader>

        <SidebarBody className={styles.EntrySidebar.body()}>
          {sidebar.type === 'error' && (
            <p className={styles.EntrySidebar.empty()}>
              {sidebar.error.message}
            </p>
          )}
          {!isMediaFile && (
            <>
              <TabPanel
                id="history"
                className={styles.EntrySidebar.historyPanel()}
              >
                <EntrySidebarHistory
                  entry={entry}
                  page={page}
                  sidebar={sidebar}
                />
              </TabPanel>
              {hasPreview && (
                <TabPanel
                  id="preview"
                  className={styles.EntrySidebar.previewPanel()}
                >
                  <EntrySidebarPreview entry={entry} sidebar={sidebar} />
                </TabPanel>
              )}
            </>
          )}
          <TabPanel
            id="references"
            className={styles.EntrySidebar.referencesPanel()}
          >
            <EntryReferences
              entry={entry}
              references={
                sidebar.type === 'references' ? sidebar.references : undefined
              }
            />
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}

interface EntrySidebarHistoryProps {
  entry: EntryDataAtoms
  page: EntryPageData
  sidebar: EntrySidebarData
}

function EntrySidebarHistory({entry, page, sidebar}: EntrySidebarHistoryProps) {
  const statuses = sidebar.type === 'history' ? sidebar.statuses : []
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
              page={page}
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
              <EntrySidebarPreviousVersions entry={entry} sidebar={sidebar} />
            )}
          </DisclosurePanel>
        </Disclosure>
      </section>
    </div>
  )
}

function EntrySidebarPreviousVersions({
  entry,
  sidebar
}: Omit<EntrySidebarHistoryProps, 'page'>) {
  const history = sidebar.type === 'history' ? sidebar.history : []
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
  entry: EntryDataAtoms
  page: EntryPageData
  status: EntryStatus
}

function EntrySidebarStatusItem({
  entry,
  page,
  status
}: EntrySidebarStatusItemProps) {
  const type = useAtomValue(entry.type)
  const versions = page.versions
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = page.activeVersion
  const currentlyEditing = useAtomValue(entry.currentlyEditing)
  const [selectedVersion, setSelectedVersion] = useAtom(entry.selectedVersion)
  const isEditing = activeStatus === status && currentlyEditing !== undefined
  const selected =
    selectedVersion.type === 'status' && selectedVersion.status === status
  const rowStatus = getStatusItemVersionStatus(status, activeVersion?.main)
  const version = versions.get(status)
  const hasMetadata = Type.field(type, 'metadata') instanceof MetadataField
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
        {isEditing && <Badge size="small">Editing</Badge>}
      </EntrySidebarVersionRow>
    </li>
  )
}

interface EntrySidebarRevisionItemProps {
  entry: EntryDataAtoms
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
