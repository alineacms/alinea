import {Button, Icon, Surface} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {typeAtoms, workspaceAtoms} from '#/dashboard/atoms/config.js'
import {dashboardAtoms} from '#/dashboard/atoms/dashboard.js'
import {
  entryAtoms,
  MissingEntryError,
  type EntryAtoms,
  type EntryLocaleAtoms
} from '#/dashboard/atoms/entry.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {
  Page,
  page,
  routeAtom,
  routeBlockAtom,
  routeGuardAtom
} from '#/dashboard/atoms/nav.js'
import {rootAtoms, type RootAtoms} from '#/dashboard/atoms/root.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect} from 'react'
import {EntryScope} from '../../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit
} from '../../icons.js'
import {FileEditor} from './../editor/FileEditor.js'
import {Explorer} from './../Explorer.js'
import {NodeEditor} from './../EntryFields.js'
import {EntryHeader} from './../EntryHeader.js'
import {EntrySidebar} from './../EntrySidebar.js'
import {EntryTranslationBanner} from './../EntryTranslationBanner.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './../ui/DashboardModal.js'
import {Rail, RailBody, RailContent} from './../ui/Rail.js'
import css from './EntryPage.module.css'

const styles = styler(css)

export const entryPage = page(async (page, get) => {
  assert(page.entry, 'Entry id expected')
  try {
    const entry = await get(entryAtoms(page, page.entry))
    const localeData = entry.locales(page.locale ?? null)
    const [selectedEntry, selectedNode, parentNeedsTranslation, sourceLocale] =
      await Promise.all([
        get(localeData.selectedEntry),
        get(localeData.selectedNode),
        get(localeData.parentNeedsTranslation),
        get(localeData.translationSourceLocale),
        get(entry.type),
        get(entry.parentId),
        get(entry.workspace),
        get(entry.root),
        get(entry.hasChildren),
        get(entry.canPublishParents),
        get(entry.parentUnpublished),
        get(entry.mediaI18n),
        get(entry.preview),
        get(entry.translationSourceLocales),
        get(entry.view),
        get(localeData.untranslated),
        get(localeData.versions),
        get(localeData.availableStatuses),
        get(localeData.history),
        get(localeData.previewEntry),
        get(localeData.previewUrl),
        get(entry.incomingReferences)
      ])
    const root = rootAtoms(
      page,
      get(entry.workspace),
      get(entry.root),
      page.locale ?? null
    )
    await get(root.treeReady)
    if (get(entry.view) === 'overview') await get(root.children(entry.id).items)
    return (
      <EntryEditor
        entry={entry}
        localeData={localeData}
        node={selectedNode}
        page={page}
        parentNeedsTranslation={parentNeedsTranslation}
        selectedEntry={selectedEntry}
        sourceLocale={sourceLocale}
        root={root}
      />
    )
  } catch (error) {
    if (!(error instanceof MissingEntryError)) throw error
    return <MissingEntry page={page} />
  }
})

interface MissingEntryProps {
  page: Page
}

function MissingEntry({page}: MissingEntryProps) {
  assert(page.workspace && page.root && page.entry)
  const {rootsAtom} = workspaceAtoms(page.workspace)
  const root = useAtomValue(rootsAtom(page.root))
  const setRoute = useSetAtom(routeAtom)
  return (
    <NotFoundPanel
      title="Entry not found"
      message="The requested entry could not be found. It may have been deleted, moved, or is no longer available."
      requestedLabel="Requested id"
      requestedValue={page.entry}
      actionLabel={`Go to ${root.label}`}
      onAction={() =>
        setRoute({
          workspace: page.workspace,
          root: page.root,
          locale: page.locale ?? undefined
        })
      }
    />
  )
}

interface NotFoundPanelProps {
  title: string
  message: string
  requestedLabel: string
  requestedValue: string
  actionLabel?: string
  onAction?: () => void
}

function NotFoundPanel({
  title,
  message,
  requestedLabel,
  requestedValue,
  actionLabel,
  onAction
}: NotFoundPanelProps) {
  return (
    <Rail main>
      <RailBody className={styles.MissingEntry()}>
        <Surface className={styles.MissingEntry.card()}>
          <div className={styles.MissingEntry.icon()}>
            <Icon icon={IcBaselineErrorOutline} />
          </div>
          <h1 className={styles.MissingEntry.title()}>{title}</h1>
          <p className={styles.MissingEntry.message()}>{message}</p>
          <p className={styles.MissingEntry.message()}>
            {requestedLabel}:{' '}
            <code className={styles.MissingEntry.id()}>{requestedValue}</code>
          </p>
          {onAction && actionLabel && (
            <Button onPress={onAction}>{actionLabel}</Button>
          )}
        </Surface>
      </RailBody>
    </Rail>
  )
}

interface EntryViewToggleProps {
  entry: EntryAtoms
}

function EntryViewToggle({entry}: EntryViewToggleProps) {
  const [view, setView] = useAtom(entry.view)
  const nextView = view === 'overview' ? 'edit' : 'overview'
  const label = nextView === 'overview' ? 'Show overview' : 'Edit entry'
  const ViewIcon = nextView === 'overview' ? IcOutlineViewList : IcRoundEdit
  return (
    <Button
      aria-label={label}
      appearance="plain"
      icon={ViewIcon}
      size="icon"
      onPress={() => setView(nextView)}
    />
  )
}

interface EntryEditorProps {
  page: Page
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  parentNeedsTranslation: boolean
  selectedEntry: Entry
  sourceLocale: string | null
  root: RootAtoms
  node: ReactiveNode<object>
}

function EntryEditor({
  page,
  entry,
  localeData,
  parentNeedsTranslation,
  selectedEntry,
  sourceLocale,
  root,
  node
}: EntryEditorProps) {
  const view = useAtomValue(entry.view)
  if (view === 'overview') return <EntryOverview entry={entry} root={root} />
  return (
    <EntryEditorContent
      entry={entry}
      localeData={localeData}
      node={node}
      page={page}
      parentNeedsTranslation={parentNeedsTranslation}
      root={root}
      selectedEntry={selectedEntry}
      sourceLocale={sourceLocale}
    />
  )
}

interface EntryOverviewProps {
  entry: EntryAtoms
  root: RootAtoms
}

function EntryOverview({entry, root}: EntryOverviewProps) {
  return (
    <Rail main>
      <Explorer
        explorer={root.children(entry.id)}
        titleControls={<EntryViewToggle entry={entry} />}
      />
    </Rail>
  )
}

function EntryEditorContent({
  page,
  entry,
  localeData,
  parentNeedsTranslation,
  selectedEntry,
  sourceLocale,
  node
}: EntryEditorProps) {
  const typeName = useAtomValue(entry.type)
  const type = useAtomValue(typeAtoms(typeName))
  const hasChildren = useAtomValue(entry.hasChildren)
  const sourceLocales = useAtomValue(entry.translationSourceLocales)
  const View = type.customView
  const locale = page.locale ?? null
  const isUntranslated = selectedEntry.locale !== locale
  const setEditing = useSetAtom(localeData.currentlyEditing)
  const setSourceLocale = useSetAtom(localeData.translationSourceLocale)
  const saveDraft = useSetAtom(localeData.saveDraft)
  const publishEdits = useSetAtom(localeData.publishEdits)
  const isDirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(routeBlockAtom)
  const setRouteGuard = useSetAtom(routeGuardAtom)
  const [isSidebarOpen, setSidebarOpen] = useAtom(
    dashboardAtoms.entrySidebarOpen
  )
  const isMediaFile = type.type === MediaFile
  const isMediaLibrary = type.type === MediaLibrary
  const mediaDraftsDisabled = isMediaFile || isMediaLibrary

  const discardAndConfirm = () => {
    reset()
    routeBlock?.confirm()
  }

  const saveAndConfirm = async () => {
    if (mediaDraftsDisabled) await publishEdits(node)
    else await saveDraft(node)
    routeBlock?.confirm()
  }

  useEffect(() => {
    if (node.readOnly && !isUntranslated) return
    setEditing(isUntranslated || isDirty ? node : undefined)
  }, [isDirty, isUntranslated, node, setEditing])

  useEffect(() => {
    setRouteGuard(node.isDirty)
    return () => {
      setRouteGuard(current => (current === node.isDirty ? null : current))
    }
  }, [node, setRouteGuard])

  let editorBody = (
    <>
      <RailBody className={styles.EntryEditor.body()}>
        <RailContent>
          {isUntranslated && (
            <div className={styles.EntryEditor.banner()}>
              <EntryTranslationBanner
                parentNeedsTranslation={parentNeedsTranslation}
                sourceLocale={sourceLocale}
                sourceLocales={sourceLocales}
                onSourceLocaleChange={setSourceLocale}
              />
            </div>
          )}

          <NodeEditor node={node} type={type.type} />
        </RailContent>
      </RailBody>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        <RailBody className={styles.EntryEditor.body()}>
          <NodeEditor node={node} type={type.type}>
            <FileEditor entry={entry} />
          </NodeEditor>
        </RailBody>
      </>
    )
  }

  if (View) {
    return (
      <EntryScope entry={entry} localeData={localeData}>
        <View type={type.type} />
      </EntryScope>
    )
  }

  const hasSidebar = !isUntranslated

  const mainEditor = (
    <Rail main>
      <EntryHeader
        controls={hasChildren ? <EntryViewToggle entry={entry} /> : undefined}
        entry={entry}
        isSidebarOpen={isSidebarOpen}
        localeData={localeData}
        node={node}
        onSidebarOpenChange={hasSidebar ? setSidebarOpen : undefined}
      />

      {editorBody}

      <div id="alinea-toolbar" className={styles.EntryEditor.toolbar()} />
    </Rail>
  )

  return (
    <>
      <DashboardModal
        isOpen={Boolean(routeBlock)}
        onOpenChange={open => !open && setRouteBlock(null)}
      >
        {routeBlock && (
          <DashboardModalDialog label="Confirm navigation">
            <DashboardModalContent>
              This entry has unsaved changes
            </DashboardModalContent>
            <DashboardModalFooter>
              <Button onPress={discardAndConfirm} intent="secondary">
                Discard my changes
              </Button>
              <Button onPress={saveAndConfirm} intent="primary">
                {mediaDraftsDisabled ? 'Publish' : 'Save as draft'}
              </Button>
            </DashboardModalFooter>
          </DashboardModalDialog>
        )}
      </DashboardModal>
      <EntryScope entry={entry} localeData={localeData}>
        {mainEditor}
        {hasSidebar && isSidebarOpen && (
          <EntrySidebar
            entry={entry}
            localeData={localeData}
            onOpenChange={setSidebarOpen}
          />
        )}
      </EntryScope>
    </>
  )
}
