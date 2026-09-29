import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  List,
  ListEmpty,
  ListItem,
  ListItemDescription,
  ListItemTitle,
  ListItemVisual,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Timestamp
} from '#/components.js'
import {Revision} from '#/core/Connection.js'
import type {Entry, EntryStatus} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {localAtom} from '#/dashboard/atoms/core.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {MetadataField, type Metadata} from '#/field/metadata.js'
import {styler} from '@alinea/styler'
import {
  atom,
  type Getter,
  useAtom,
  useAtomValueRaw,
  useAtomValueRawSync,
  useSetAtom
} from 'jotai'
import {type ComponentType, type ReactNode} from 'react'
import {
  IcOutlineDrafts,
  IcRoundArchive,
  IcRoundEdit,
  IcRoundHistory,
  IcRoundVisibility,
  IcRoundVisibilityOff
} from '../icons.js'
import {EntryReferences} from './EntryReferences.js'
import css from './EntrySidebar.module.css'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'

const styles = styler(css)

export interface EntrySidebarProps {
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  selectedTab: EntrySidebarTab
  previousVersionsOpen: boolean
  /** The entry a preview component renders, loaded with the page */
  previewEntry?: Entry
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
  let previewEntry: Entry | undefined
  switch (selectedTab) {
    case 'preview': {
      const preview = get(entry.preview)
      if (preview === true) void get(localeData.previewUrlReady)
      else if (preview) previewEntry = await get(localeData.previewEntryReady)
      break
    }
    case 'history':
      if (!previousVersionsOpen) break
      // Local history is expanded by default, load it in place so navigation
      // does not wait for it
      if (get(localAtom)) void get(localeData.historyReady)
      else await get(localeData.historyReady)
      break
    case 'references':
      await get(entry.incomingReferencesReady)
      break
  }
  return {entry, localeData, selectedTab, previousVersionsOpen, previewEntry}
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
  previewEntry,
  onOpenChange
}: EntrySidebarProps) {
  const typeName = useAtomValueRaw(entry.type)
  const type = useAtomValueRaw(typeAtoms(typeName)).type
  const setSelectedTab = useSetAtom(entrySidebarTabAtom)
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const hasPreview = !isMediaFile && !isMediaLibrary
  const allowedTabs = entrySidebarTabs(type)
  return (
    <Sidebar side="right">
      <Tabs
        className={styles.EntrySidebar.tabs()}
        value={selectedTab}
        onValueChange={value => {
          const next = value as EntrySidebarTab
          if (allowedTabs.includes(next)) setSelectedTab(next)
        }}
      >
        <SidebarHeader>
          <TabsList aria-label="Entry sidebar">
            {hasPreview && <TabsTrigger value="preview">Preview</TabsTrigger>}
            {!isMediaFile && <TabsTrigger value="history">History</TabsTrigger>}
            <TabsTrigger value="references">References</TabsTrigger>
          </TabsList>
          {onOpenChange && (
            <EntrySidebarToggle isOpen={true} onOpenChange={onOpenChange} />
          )}
        </SidebarHeader>
        <SidebarContent className={styles.EntrySidebar.body()}>
          {hasPreview && (
            <TabsContent
              value="preview"
              className={styles.EntrySidebar.previewPanel()}
            >
              <EntrySidebarPreview
                entry={entry}
                localeData={localeData}
                previewEntry={previewEntry}
              />
            </TabsContent>
          )}
          {!isMediaFile && (
            <TabsContent
              value="history"
              className={styles.EntrySidebar.historyPanel()}
            >
              <EntrySidebarHistory
                entry={entry}
                localeData={localeData}
                previousVersionsOpen={previousVersionsOpen}
              />
            </TabsContent>
          )}
          <TabsContent
            value="references"
            className={styles.EntrySidebar.referencesPanel()}
          >
            <EntryReferences entry={entry} localeData={localeData} />
          </TabsContent>
        </SidebarContent>
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
  const statuses = useAtomValueRaw(localeData.availableStatuses)
  const setPreviousVersionsOpen = useSetAtom(entry.previousVersionsOpen)
  return (
    <div className={styles.EntrySidebar.history()}>
      <section className={styles.EntrySidebar.section()}>
        <Text asChild color="muted" weight="medium">
          <h2 className={styles.EntrySidebar.sectionTitle()}>
            Current versions
          </h2>
        </Text>
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
        <Collapsible
          key={entry.id}
          className={styles.EntrySidebar.disclosure()}
          open={previousVersionsOpen}
          onOpenChange={setPreviousVersionsOpen}
        >
          <CollapsibleTrigger
            className={styles.EntrySidebar.disclosureTrigger()}
          >
            Previous versions
          </CollapsibleTrigger>
          <CollapsibleContent className={styles.EntrySidebar.disclosurePanel()}>
            <EntrySidebarPreviousVersions localeData={localeData} />
          </CollapsibleContent>
        </Collapsible>
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
  const [pending, history = []] = useAtomValueRawSync(localeData.historyState)
  if (pending && history.length === 0)
    return (
      <div className={styles.EntrySidebar.loading()}>
        <Spinner aria-label="Loading previous versions" />
      </div>
    )
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
  const typeName = useAtomValueRaw(entry.type)
  const type = useAtomValueRaw(typeAtoms(typeName)).type
  const versions = useAtomValueRaw(localeData.versions)
  const currentlyEditing = useAtomValueRaw(localeData.currentlyEditing)
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
      onClick={() => setSelectedVersion({type: 'status', status})}
    >
      {isEditing && <Badge size="sm">Editing</Badge>}
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
      title={<Timestamp date={revision.createdAt} />}
      meta={revision.user?.name}
      onClick={() =>
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
  onClick?: () => void
}

export function EntrySidebarVersionRow({
  selected = false,
  status = 'none',
  icon,
  title,
  meta,
  children,
  onClick
}: EntrySidebarVersionRowProps) {
  return (
    <ListItem
      data-status={status}
      leading={
        <ListItemVisual>
          <Icon data-slot="icon" icon={icon} />
        </ListItemVisual>
      }
      onClick={onClick}
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

function formatMetadata(metadata: unknown) {
  if (!isMetadata(metadata) || typeof metadata.updatedAt !== 'number') {
    return undefined
  }
  const updatedAt = (
    <Timestamp date={metadata.updatedAt * 1000} format="relative" />
  )
  const updatedBy = metadata.updatedBy.name
  if (!updatedBy) return updatedAt
  return (
    <>
      {updatedBy} · {updatedAt}
    </>
  )
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
