import {
  Button,
  Code,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Page as PageLayout,
  PageContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {isFileType, isMediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {entrySidebarOpen} from '#/dashboard/atoms/dashboard.js'
import type {ExplorerReadyPage} from '#/dashboard/atoms/explorer.js'
import {
  entryAtoms,
  MissingEntryError,
  type EntryAtoms,
  type EntryLocaleAtoms
} from '#/dashboard/atoms/entry.js'
import type {ResolvedEditorImage} from '#/dashboard/atoms/editor.js'
import {
  entryLock,
  type EntryLockAtoms,
  type LockStatus
} from '#/dashboard/atoms/lock.js'
import {
  Page,
  page,
  routeAtom,
  routeBlockAtom,
  routeGuardAtom
} from '#/dashboard/atoms/nav.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {rootAtoms, type RootAtoms} from '#/dashboard/atoms/root.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {styler} from '@alinea/styler'
import {atom, useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {type ReactNode, useEffect, useLayoutEffect, useRef} from 'react'
import {EntryScope} from '../../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit,
  IcRoundCheck,
  IcRoundSave
} from '../../icons.js'
import {FileEditor} from './../editor/FileEditor.js'
import {CreateEntryButton} from './../DashboardLayout.js'
import {EntryFields} from './../EntryFields.js'
import {NodeEditor} from './../NodeEditor.js'
import {entryForm} from '../EntryForm.js'
import {EntryHeader} from './../EntryHeader.js'
import {EntryLockDialogs, EntryLockNotice} from './../EntryLock.js'
import {entryDirtyActions} from './../EntryHeaderActions.js'
import {
  EntrySidebar,
  entrySidebar,
  type EntrySidebarProps
} from './../EntrySidebar.js'
import {EntryTranslationBanner} from './../EntryTranslationBanner.js'
import {Explorer} from './../Explorer.js'
import {SidebarLayout} from '../SidebarLayout.js'
import {
  BlockSheetProvider,
  BlockSheetSlot,
  useBlockSheetOpen
} from '../BlockSheet.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './../ui/DashboardModal.js'
import css from './EntryPage.module.css'

const styles = styler(css)
const noLock = atom(undefined)

export const entryPage = page(async (page, get) => {
  assert(page.entry, 'Entry id expected')
  try {
    const entry = await get(entryAtoms(page.entry))
    const localeData = entry.locales(page.locale)
    const type = get(typeAtoms(get(entry.type)))
    const view = page.view ?? get(entry.view)
    const selectedEntry = await get(localeData.selectedEntry)
    if (view === 'overview') {
      const root = rootAtoms(get(entry.workspace), get(entry.root))
      const explorerPage = await get(root.children(entry.id).pageReady)
      return (
        <EntryOverview
          entry={entry}
          explorerPage={explorerPage}
          page={page}
          root={root}
          selectedEntry={selectedEntry}
        />
      )
    }
    const selectedNode = await get(localeData.selectedNode)
    const richTextImages = await get(localeData.richTextImages)
    const parentNeedsTranslation = await get(localeData.parentNeedsTranslation)
    const sourceLocale = get(localeData.translationSourceLocale)
    const copyTranslationSource = get(localeData.copyTranslationSource)
    const isSidebarOpen = get(entrySidebarOpen(Boolean(get(entry.preview))))
    const sidebar = await entrySidebar(get, entry, localeData, isSidebarOpen)
    // Only editors take part, someone reading along does not hold the entry
    const lock = selectedNode.readOnly
      ? undefined
      : entryLock(entry.id, page.locale)
    const lockStatus = lock && (await get(lock.ready))
    return (
      <EntryEditorContent
        entry={entry}
        lock={lock}
        lockStatus={lockStatus}
        copyTranslationSource={copyTranslationSource}
        isSidebarOpen={Boolean(sidebar && isSidebarOpen)}
        localeData={localeData}
        node={selectedNode}
        page={page}
        parentNeedsTranslation={parentNeedsTranslation}
        richTextImages={richTextImages}
        selectedEntry={selectedEntry}
        sidebar={sidebar}
        sourceLocale={sourceLocale}
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
  const root = useAtomValueRaw(rootAtoms(page.workspace, page.root).data)
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

export interface NotFoundPanelProps {
  title: string
  message: string
  requestedLabel: string
  requestedValue: string
  actionLabel?: string
  onAction?: () => void
}

export function NotFoundPanel({
  title,
  message,
  requestedLabel,
  requestedValue,
  actionLabel,
  onAction
}: NotFoundPanelProps) {
  return (
    <PageLayout>
      <PageContent className={styles.MissingEntry()}>
        <Empty variant="card">
          <EmptyHeader>
            <EmptyMedia variant="icon" className={styles.MissingEntry.media()}>
              <Icon icon={IcBaselineErrorOutline} />
            </EmptyMedia>
            <EmptyTitle as="h1">{title}</EmptyTitle>
            <EmptyDescription>{message}</EmptyDescription>
            <EmptyDescription>
              {requestedLabel}: <Code>{requestedValue}</Code>
            </EmptyDescription>
          </EmptyHeader>
          {onAction && actionLabel && (
            <EmptyContent>
              <Button onClick={onAction}>{actionLabel}</Button>
            </EmptyContent>
          )}
        </Empty>
      </PageContent>
    </PageLayout>
  )
}

interface EntryViewToggleProps {
  entry: EntryAtoms
  page: Page
}

function EntryViewToggle({entry, page}: EntryViewToggleProps) {
  const entryView = useAtomValueRaw(entry.view)
  const view = page.view ?? entryView
  const setRoute = useSetAtom(routeAtom)
  const nextView = view === 'overview' ? 'edit' : 'overview'
  const label = nextView === 'overview' ? 'Show overview' : 'Edit entry'
  const tooltip = nextView === 'overview' ? 'Overview view' : 'Edit view'
  const ViewIcon = nextView === 'overview' ? IcOutlineViewList : IcRoundEdit
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger
        aria-label={label}
        variant="ghost"
        icon={ViewIcon}
        size="icon"
        onClick={() =>
          setRoute({
            workspace: page.workspace,
            root: page.root,
            entry: page.entry,
            locale: page.locale ?? undefined,
            view: nextView
          })
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

interface EntryEditorContentProps {
  page: Page
  entry: EntryAtoms
  copyTranslationSource: boolean
  isSidebarOpen: boolean
  localeData: EntryLocaleAtoms
  lock: EntryLockAtoms | undefined
  lockStatus: LockStatus | undefined
  parentNeedsTranslation: boolean
  richTextImages: ReadonlyMap<string, ResolvedEditorImage>
  selectedEntry: Entry
  sidebar: EntrySidebarProps | undefined
  sourceLocale: string | null
  node: ReactiveNode<object>
}

interface EntryOverviewProps {
  entry: EntryAtoms
  explorerPage: ExplorerReadyPage
  page: Page
  root: RootAtoms
  selectedEntry: Entry
}

function EntryOverview({
  entry,
  explorerPage,
  page,
  root,
  selectedEntry
}: EntryOverviewProps) {
  const setRoute = useSetAtom(routeAtom)
  const policy = useAtomValueRaw(policyAtom)
  const parentId = selectedEntry.parentId
  return (
    <PageLayout>
      <Explorer
        controls={
          <div className={styles.EntryOverview.mobileActions()}>
            <CreateEntryButton root={root} toolbar />
          </div>
        }
        explorer={root.children(entry.id)}
        page={explorerPage}
        readOnly={
          !policy.canUpdate(selectedEntry) ||
          (explorerPage.isMedia && !explorerPage.canUpload)
        }
        headerEntry={{
          backLabel: parentId ? 'Back to parent entry' : 'Back to root',
          title: selectedEntry.title,
          onBack() {
            setRoute({
              workspace: selectedEntry.workspace,
              root: selectedEntry.root,
              entry: parentId ?? undefined,
              locale: page.locale ?? undefined
            })
          }
        }}
        titleControls={<EntryViewToggle entry={entry} page={page} />}
      />
    </PageLayout>
  )
}

function EntryEditorContent({
  page,
  entry,
  copyTranslationSource,
  isSidebarOpen,
  localeData,
  lock,
  lockStatus: readyLockStatus,
  parentNeedsTranslation,
  richTextImages,
  selectedEntry,
  sidebar,
  sourceLocale,
  node
}: EntryEditorContentProps) {
  const lockStatus = useAtomValueRaw(lock?.live ?? noLock) ?? readyLockStatus
  const isDirty = useAtomValueRaw(node.isDirty)
  const typeName = useAtomValueRaw(entry.type)
  const type = useAtomValueRaw(typeAtoms(typeName))
  const hasChildren = useAtomValueRaw(entry.hasChildren)
  const defaultView = useAtomValueRaw(entry.view)
  const sourceLocales = useAtomValueRaw(entry.translationSourceLocales)
  const parentPaths = useAtomValueRaw(entry.parentPaths)
  const versions = useAtomValueRaw(localeData.versions)
  const config = useAtomValueRaw(configAtom)
  const policy = useAtomValueRaw(policyAtom)
  const View = type.customView
  const {locale} = page
  const isUntranslated = selectedEntry.locale !== locale
  const setEditing = useSetAtom(localeData.currentlyEditing)
  const setCopyTranslationSource = useSetAtom(localeData.copyTranslationSource)
  const setSourceLocale = useSetAtom(localeData.translationSourceLocale)
  const saveDraft = useSetAtom(localeData.saveDraft)
  const publishEdits = useSetAtom(localeData.publishEdits)
  const hasErrors = useAtomValueRaw(localeData.hasErrors(node))
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(routeBlockAtom)
  const setRouteGuard = useSetAtom(routeGuardAtom)
  const setSidebarOpen = useSetAtom(
    entrySidebarOpen(Boolean(useAtomValueRaw(entry.preview)))
  )
  const editorBodyRef = useRef<HTMLDivElement>(null)
  const isMediaFile = isFileType(type.type)
  const isFolder = isMediaLibrary(type.type)
  const isMedia = isMediaFile || isFolder
  const activeVersion = Array.from(versions.values()).find(
    version => version.active
  )
  assert(activeVersion, `Entry "${entry.id}" has no active version`)
  const access = policy.get(activeVersion)
  const canSaveDraft = !isMedia && Boolean(config.enableDrafts) && access.update
  const dirtyActions = entryDirtyActions(access.publish, canSaveDraft)

  const discardAndConfirm = () => {
    reset()
    routeBlock?.confirm()
  }

  const publishAndConfirm = async () => {
    await publishEdits(node)
    routeBlock?.confirm()
  }

  const saveDraftAndConfirm = async () => {
    await saveDraft(node)
    routeBlock?.confirm()
  }

  // Another session holds the entry, the lock is advisory: saving still works
  const isLocked = Boolean(lockStatus?.holder)
  const lockNotice = lock && lockStatus && isLocked && (
    <EntryLockNotice lock={lock} status={lockStatus} />
  )

  useEffect(() => {
    setEditing(node.readOnly && !isUntranslated ? undefined : node)
  }, [isUntranslated, node, setEditing])

  useEffect(() => {
    setRouteGuard(node.isDirty)
    return () => {
      setRouteGuard(current => (current === node.isDirty ? null : current))
    }
  }, [node, setRouteGuard])

  useLayoutEffect(() => {
    if (editorBodyRef.current) editorBodyRef.current.scrollTop = 0
  }, [entry.id])

  const translationBanner = isUntranslated && (
    <EntryTranslationBanner
      copyFromSource={copyTranslationSource}
      parentNeedsTranslation={parentNeedsTranslation}
      sourceLocale={sourceLocale}
      sourceLocales={sourceLocales}
      onCopyFromSourceChange={setCopyTranslationSource}
      onSourceLocaleChange={setSourceLocale}
    />
  )

  let editorBody = (
    <>
      <PageContent
        ref={editorBodyRef}
        contained
        className={styles.EntryEditor.body()}
      >
        <div className={styles.EntryEditor.fields()}>
          {lockNotice && (
            <div className={styles.EntryEditor.banner()}>{lockNotice}</div>
          )}
          {translationBanner && (
            <div className={styles.EntryEditor.banner()}>
              {translationBanner}
            </div>
          )}

          <NodeEditor
            node={node}
            readOnly={isLocked}
            type={entryForm(type.type)}
          >
            <EntryFields />
          </NodeEditor>
        </div>
      </PageContent>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        {lockNotice && (
          <div className={styles.EntryEditor.viewBanner()}>{lockNotice}</div>
        )}
        <PageContent ref={editorBodyRef} className={styles.EntryEditor.body()}>
          <NodeEditor node={node} readOnly={isLocked} type={type.type}>
            <FileEditor
              parentPaths={parentPaths}
              workspace={selectedEntry.workspace}
            />
          </NodeEditor>
        </PageContent>
      </>
    )
  }

  // A type view takes the place of the form and edits the same node, so the
  // header, sidebar and route guard save and guard its changes
  if (View) {
    editorBody = (
      <>
        {lockNotice && (
          <div className={styles.EntryEditor.viewBanner()}>{lockNotice}</div>
        )}
        {translationBanner && (
          <div className={styles.EntryEditor.viewBanner()}>
            {translationBanner}
          </div>
        )}
        <PageContent ref={editorBodyRef} className={styles.EntryEditor.view()}>
          <NodeEditor
            node={node}
            readOnly={isLocked}
            type={entryForm(type.type)}
          >
            <View type={type.type} />
          </NodeEditor>
        </PageContent>
      </>
    )
  }

  const mainEditor = (
    <PageLayout className={styles.EntryEditor()}>
      <EntryHeader
        controls={
          hasChildren || defaultView === 'overview' ? (
            <EntryViewToggle entry={entry} page={page} />
          ) : undefined
        }
        entry={entry}
        isSidebarOpen={isSidebarOpen}
        localeData={localeData}
        node={node}
        onSidebarOpenChange={sidebar ? setSidebarOpen : undefined}
        parentNeedsTranslation={parentNeedsTranslation}
        selectedEntry={selectedEntry}
      />

      {editorBody}

      <div id="alinea-toolbar" className={styles.EntryEditor.toolbar()} />
    </PageLayout>
  )

  return (
    <>
      {lock && (
        <EntryLockDialogs
          lock={lock}
          status={lockStatus}
          isDirty={isDirty}
          onDiscard={reset}
          onMerge={() =>
            void (canSaveDraft ? saveDraft(node) : publishEdits(node))
          }
        />
      )}
      <DashboardModal
        open={Boolean(routeBlock)}
        onOpenChange={open => !open && setRouteBlock(null)}
      >
        {routeBlock && (
          <DashboardModalDialog label="Confirm navigation">
            <DashboardModalContent>
              This entry has unsaved changes
              {dirtyActions.publish && hasErrors
                ? ', and some fields are invalid'
                : ''}
            </DashboardModalContent>
            <DashboardModalFooter>
              <Button onClick={discardAndConfirm} variant="ghost">
                Discard my changes
              </Button>
              <div className={styles.EntryEditorContent.navigationActions()}>
                {dirtyActions.publish && (
                  <Button
                    onClick={publishAndConfirm}
                    color={canSaveDraft ? 'secondary' : 'primary'}
                    icon={IcRoundCheck}
                  >
                    {hasErrors ? 'Publish anyway' : 'Publish'}
                  </Button>
                )}
                {dirtyActions.saveDraft && (
                  <Button
                    onClick={saveDraftAndConfirm}
                    color="primary"
                    icon={IcRoundSave}
                  >
                    Save as draft
                  </Button>
                )}
              </div>
            </DashboardModalFooter>
          </DashboardModalDialog>
        )}
      </DashboardModal>
      <EntryScope
        entry={entry}
        localeData={localeData}
        richTextImages={richTextImages}
        selectedEntry={selectedEntry}
      >
        <BlockSheetProvider>
          <EntryEditorLayout
            sidebar={
              sidebar &&
              isSidebarOpen && (
                <EntrySidebar {...sidebar} onOpenChange={setSidebarOpen} />
              )
            }
          >
            {mainEditor}
          </EntryEditorLayout>
        </BlockSheetProvider>
      </EntryScope>
    </>
  )
}

interface EntryEditorLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

/**
 * An open block sheet covers the sidebar, it shows the sidebar panel on its
 * own while the sidebar is collapsed
 */
function EntryEditorLayout({sidebar, children}: EntryEditorLayoutProps) {
  const sheetOpen = useBlockSheetOpen()
  return (
    <SidebarLayout
      side="right"
      visible={Boolean(sidebar) || sheetOpen}
      sidebar={
        <div className={styles.EntryEditorLayout.sidebar()}>
          {sidebar}
          <BlockSheetSlot />
        </div>
      }
    >
      {children}
    </SidebarLayout>
  )
}
