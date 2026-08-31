import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  Icon,
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual,
  Tab,
  TabList,
  TabPanel,
  Tabs
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {MetadataField, type Metadata} from '#/field/metadata.js'
import {styler} from '@alinea/styler'
import {atom, type Getter, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {type ComponentType, type ReactNode} from 'react'
import {
  IcOutlineDrafts,
  IcRoundArchive,
  IcRoundEdit,
  IcRoundHistory,
  IcRoundVisibility,
  IcRoundVisibilityOff
} from '../icons.js'
import {Badge} from './Badge.js'
import {EntryReferences} from './EntryReferences.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {RailHeader} from './ui/Rail.js'
import {Sidebar, SidebarBody} from './ui/Sidebar.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  selectedTab: EntrySidebarTab
  previousVersionsOpen: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export type EntrySidebarTab = 'preview' | 'history' | 'references'
const entrySidebarTabAtom = atom<EntrySidebarTab>('preview')

export async function entrySidebar(
  get: Getter,
  entry: EntryAtoms,
  localeData: EntryLocaleAtoms,
  isOpen = true
): Promise<EntrySidebarProps | undefined> {
  const typeName = get(entry.type)
  const type = get(typeAtoms(typeName))
  if (type.customView || get(localeData.untranslated)) return undefined
  const allowedTabs = entrySidebarTabs(type.type)
  const requestedTab = get(entrySidebarTabAtom)
  const selectedTab = allowedTabs.includes(requestedTab)
    ? requestedTab
    : allowedTabs[0]
  const previousVersionsOpen =
    selectedTab === 'history' ? get(entry.previousVersionsOpen) : false
  if (!isOpen) return {entry, localeData, selectedTab, previousVersionsOpen}
  switch (selectedTab) {
    case 'preview': {
      const preview = get(entry.preview)
      if (preview === true) await get(localeData.previewUrlReady)
      else if (preview) await get(localeData.previewEntryReady)
      break
    }
    case 'history':
      if (previousVersionsOpen) await get(localeData.historyReady)
      break
    case 'references':
      await get(entry.incomingReferencesReady)
      break
  }
  return {entry, localeData, selectedTab, previousVersionsOpen}
}

function entrySidebarTabs(type: Type): Array<EntrySidebarTab> {
  if (type === MediaFile) return ['references']
  if (type === MediaLibrary) return ['history', 'references']
  return ['preview', 'history', 'references']
}

export function EntrySidebar({
  entry,
  localeData,
  selectedTab,
  previousVersionsOpen,
  onOpenChange
}: EntrySidebarProps) {
  const typeName = useAtomValue(entry.type)
  const type = useAtomValue(typeAtoms(typeName)).type
  const setSelectedTab = useSetAtom(entrySidebarTabAtom)
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const hasPreview = !isMediaFile && !isMediaLibrary
  const allowedTabs = entrySidebarTabs(type)
  return (
    <Sidebar>
      <Tabs
        className={styles.EntrySidebar.tabs()}
        selectedKey={selectedTab}
        onSelectionChange={key => {
          const next = key as EntrySidebarTab
          if (allowedTabs.includes(next)) setSelectedTab(next)
        }}
      >
        <RailHeader className={styles.EntrySidebar.header()}>
          <TabList aria-label="Entry sidebar">
            {hasPreview && <Tab id="preview">Preview</Tab>}
            {!isMediaFile && <Tab id="history">History</Tab>}
            <Tab id="references">References</Tab>
          </TabList>
          {onOpenChange && (
            <EntrySidebarToggle isOpen={true} onOpenChange={onOpenChange} />
          )}
        </RailHeader>
        <SidebarBody className={styles.EntrySidebar.body()}>
          {hasPreview && (
            <TabPanel
              id="preview"
              className={styles.EntrySidebar.previewPanel()}
            >
              <EntrySidebarPreview entry={entry} localeData={localeData} />
            </TabPanel>
          )}
          {!isMediaFile && (
            <TabPanel
              id="history"
              className={styles.EntrySidebar.historyPanel()}
            >
              <EntrySidebarHistory
                entry={entry}
                localeData={localeData}
                previousVersionsOpen={previousVersionsOpen}
              />
            </TabPanel>
          )}
          <TabPanel
            id="references"
            className={styles.EntrySidebar.referencesPanel()}
          >
            <EntryReferences entry={entry} localeData={localeData} />
          </TabPanel>
        </SidebarBody>
      </Tabs>
    </Sidebar>
  )
}

interface EntrySidebarHistoryProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  previousVersionsOpen: boolean
}

function EntrySidebarHistory({
  entry,
  localeData,
  previousVersionsOpen
}: EntrySidebarHistoryProps) {
  const statuses = useAtomValue(localeData.availableStatuses)
  const setPreviousVersionsOpen = useSetAtom(entry.previousVersionsOpen)
  return (
    <div className={styles.EntrySidebar.history()}>
      <section className={styles.EntrySidebar.section()}>
        <h2 className={styles.EntrySidebar.sectionTitle()}>Current versions</h2>
        <List aria-label="Current versions">
          {statuses.map(status => (
            <EntrySidebarStatusItem
              entry={entry}
              key={status}
              localeData={localeData}
              status={status}
            />
          ))}
        </List>
      </section>
      <section className={styles.EntrySidebar.section()}>
        <Disclosure
          key={entry.id}
          className={styles.EntrySidebar.disclosure()}
          isExpanded={previousVersionsOpen}
          onExpandedChange={setPreviousVersionsOpen}
        >
          <DisclosureHeader>Previous versions</DisclosureHeader>
          <DisclosurePanel className={styles.EntrySidebar.disclosurePanel()}>
            {previousVersionsOpen && (
              <EntrySidebarPreviousVersions localeData={localeData} />
            )}
          </DisclosurePanel>
        </Disclosure>
      </section>
    </div>
  )
}

interface EntrySidebarPreviousVersionsProps {
  localeData: EntryLocaleAtoms
}

function EntrySidebarPreviousVersions({
  localeData
}: EntrySidebarPreviousVersionsProps) {
  const history = useAtomValue(localeData.history)
  if (history.length === 0)
    return (
      <List aria-label="Previous versions" empty>
        <ListEmpty icon={IcRoundHistory} title="No history">
          No previous versions yet.
        </ListEmpty>
      </List>
    )
  return (
    <List aria-label="Previous versions">
      {history.map(revision => (
        <EntrySidebarRevisionItem
          key={`${revision.file}:${revision.ref}`}
          localeData={localeData}
          revision={revision}
        />
      ))}
    </List>
  )
}

interface EntrySidebarStatusItemProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  status: EntryStatus
}

function EntrySidebarStatusItem({
  entry,
  localeData,
  status
}: EntrySidebarStatusItemProps) {
  const typeName = useAtomValue(entry.type)
  const type = useAtomValue(typeAtoms(typeName)).type
  const versions = useAtomValue(localeData.versions)
  const currentlyEditing = useAtomValue(localeData.currentlyEditing)
  const [selectedVersion, setSelectedVersion] = useAtom(
    localeData.selectedVersion
  )
  const activeVersion = Array.from(versions.values()).find(
    version => version.active
  )
  assert(activeVersion, `Entry "${entry.id}" has no active version`)
  const isEditing = activeVersion.status === status && Boolean(currentlyEditing)
  const selected =
    (selectedVersion === null && activeVersion.status === status) ||
    (selectedVersion?.type === 'status' && selectedVersion.status === status)
  const rowStatus = getStatusItemVersionStatus(status, activeVersion.main)
  const version = versions.get(status)
  const hasMetadata = Type.field(type, 'metadata') instanceof MetadataField
  const meta = hasMetadata ? formatMetadata(version?.data.metadata) : undefined
  return (
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
  )
}

interface EntrySidebarRevisionItemProps {
  localeData: EntryLocaleAtoms
  revision: Revision
}

function EntrySidebarRevisionItem({
  localeData,
  revision
}: EntrySidebarRevisionItemProps) {
  const [selectedVersion, setSelectedVersion] = useAtom(
    localeData.selectedVersion
  )
  const selected =
    selectedVersion?.type === 'history' &&
    selectedVersion.ref === revision.ref &&
    selectedVersion.file === revision.file
  const revisionKind = getRevisionKind(revision)
  return (
    <EntrySidebarVersionRow
      selected={selected}
      status={revisionKind.status}
      icon={revisionKind.icon}
      title={formatTime(revision.createdAt)}
      meta={revision.user?.name}
      onPress={() =>
        setSelectedVersion({
          type: 'history',
          file: revision.file,
          ref: revision.ref
        })
      }
    />
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
    <ListItem
      data-status={status}
      leading={
        <ListItemVisual>
          <Icon data-slot="icon" icon={icon} />
        </ListItemVisual>
      }
      onPress={onPress}
      selected={selected}
      trailing={children}
    >
      <ListItemTitle>{title}</ListItemTitle>
      {meta && <ListItemDescription>{meta}</ListItemDescription>}
    </ListItem>
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
