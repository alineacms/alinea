import {Button, Icon, Surface, Tooltip} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {entrySidebarOpenAtom} from '#/dashboard/atoms/dashboard.js'
import type {ExplorerReadyPage} from '#/dashboard/atoms/explorer.js'
import {
  entryAtoms,
  MissingEntryError,
  type EntryAtoms,
  type EntryLocaleAtoms
} from '#/dashboard/atoms/entry.js'
import type {ResolvedEditorImage} from '#/dashboard/atoms/editor.js'
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
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useEffect, useLayoutEffect, useRef} from 'react'
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
import {EntryFields, NodeEditor} from './../EntryFields.js'
import {EntryHeader} from './../EntryHeader.js'
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
    const parentNeedsTranslation = type.customView
      ? false
      : await get(localeData.parentNeedsTranslation)
    const sourceLocale = get(localeData.translationSourceLocale)
    const copyTranslationSource = get(localeData.copyTranslationSource)
    const isSidebarOpen = get(entrySidebarOpenAtom)
    const sidebar = await entrySidebar(get, entry, localeData, isSidebarOpen)
    return (
      <EntryEditorContent
        entry={entry}
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
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </Surface>
      </RailBody>
    </Rail>
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
    <Tooltip delay={300} tooltip={tooltip}>
      <Button
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
    </Tooltip>
  )
}

interface EntryEditorContentProps {
  page: Page
  entry: EntryAtoms
  copyTranslationSource: boolean
  isSidebarOpen: boolean
  localeData: EntryLocaleAtoms
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
    <Rail main>
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
    </Rail>
  )
}

function EntryEditorContent({
  page,
  entry,
  copyTranslationSource,
  isSidebarOpen,
  localeData,
  parentNeedsTranslation,
  richTextImages,
  selectedEntry,
  sidebar,
  sourceLocale,
  node
}: EntryEditorContentProps) {
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
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(routeBlockAtom)
  const setRouteGuard = useSetAtom(routeGuardAtom)
  const setSidebarOpen = useSetAtom(entrySidebarOpenAtom)
  const editorBodyRef = useRef<HTMLDivElement>(null)
  const isMediaFile = type.type === MediaFile
  const isMediaLibrary = type.type === MediaLibrary
  const isMedia = isMediaFile || isMediaLibrary
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

  let editorBody = (
    <>
      <RailBody ref={editorBodyRef} className={styles.EntryEditor.body()}>
        <RailContent className={styles.EntryEditor.fields()}>
          {isUntranslated && (
            <div className={styles.EntryEditor.banner()}>
              <EntryTranslationBanner
                copyFromSource={copyTranslationSource}
                parentNeedsTranslation={parentNeedsTranslation}
                sourceLocale={sourceLocale}
                sourceLocales={sourceLocales}
                onCopyFromSourceChange={setCopyTranslationSource}
                onSourceLocaleChange={setSourceLocale}
              />
            </div>
          )}

          <NodeEditor node={node} type={type.type}>
            <EntryFields />
          </NodeEditor>
        </RailContent>
      </RailBody>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        <RailBody ref={editorBodyRef} className={styles.EntryEditor.body()}>
          <NodeEditor node={node} type={type.type}>
            <FileEditor
              parentPaths={parentPaths}
              workspace={selectedEntry.workspace}
            />
          </NodeEditor>
        </RailBody>
      </>
    )
  }

  if (View) {
    return (
      <EntryScope
        entry={entry}
        localeData={localeData}
        richTextImages={richTextImages}
        selectedEntry={selectedEntry}
      >
        <View type={type.type} />
      </EntryScope>
    )
  }

  const mainEditor = (
    <Rail main>
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
                    Publish
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
        <SidebarLayout
          side="right"
          visible={Boolean(sidebar && isSidebarOpen)}
          sidebar={
            sidebar &&
            isSidebarOpen && (
              <EntrySidebar {...sidebar} onOpenChange={setSidebarOpen} />
            )
          }
        >
          {mainEditor}
        </SidebarLayout>
      </EntryScope>
    </>
  )
}
