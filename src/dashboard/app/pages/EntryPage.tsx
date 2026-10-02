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
  PageContent
} from '#/components.js'
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
  type EntryLocaleAtoms,
  type TreeEntrySummary
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
import {type ReactNode, useEffect, useLayoutEffect, useRef} from 'react'
import {EntryScope} from '../../hooks.js'
import {
  IcBaselineErrorOutline,
  IcRoundCheck,
  IcRoundSave,
  IcRoundUndo
} from '../../icons.js'
import {FileEditor} from './../editor/FileEditor.js'
import {FieldsEditor} from './../EntryFields.js'
import {NodeEditor} from './../NodeEditor.js'
import {EntryHeader} from './../EntryHeader.js'
import {entryDirtyActions} from './../EntryHeaderActions.js'
import {
  EntrySidebar,
  entrySidebar,
  type EntrySidebarProps
} from './../EntrySidebar.js'
import {EntryTranslationBanner} from './../EntryTranslationBanner.js'
import {EntryViewToggle} from './../EntryViewToggle.js'
import {Overview} from './../Overview.js'
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
    const parents = await get(localeData.parents)
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
        parents={parents}
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

interface EntryEditorContentProps {
  page: Page
  entry: EntryAtoms
  copyTranslationSource: boolean
  isSidebarOpen: boolean
  localeData: EntryLocaleAtoms
  parents: Array<TreeEntrySummary>
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
  const policy = useAtomValueRaw(policyAtom)
  return (
    <PageLayout>
      <Overview
        explorer={root.children(entry.id)}
        page={explorerPage}
        readOnly={
          !policy.canUpdate(selectedEntry) ||
          (explorerPage.isMedia && !explorerPage.canUpload)
        }
        root={root}
        title={selectedEntry.title}
        toggle={<EntryViewToggle entry={entry} page={page} />}
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
  parents,
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
  const hasErrors = useAtomValueRaw(localeData.hasErrors(node))
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
      <PageContent ref={editorBodyRef} className={styles.EntryEditor.form()}>
        <div className={styles.EntryEditor.fields()}>
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
            <FieldsEditor />
          </NodeEditor>
        </div>
      </PageContent>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        <PageContent ref={editorBodyRef} className={styles.EntryEditor.form()}>
          <NodeEditor node={node} type={type.type}>
            <FileEditor
              parentPaths={parentPaths}
              workspace={selectedEntry.workspace}
            />
          </NodeEditor>
        </PageContent>
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
    <PageLayout>
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
        parents={parents}
        parentNeedsTranslation={parentNeedsTranslation}
        selectedEntry={selectedEntry}
      />

      {editorBody}

      <div id="alinea-toolbar" className={styles.EntryEditor.toolbar()} />
    </PageLayout>
  )

  return (
    <>
      <DashboardModal
        open={Boolean(routeBlock)}
        onOpenChange={open => !open && setRouteBlock(null)}
      >
        {routeBlock && (
          <DashboardModalDialog label="Confirm navigation">
            <DashboardModalContent>
              This entry has unsaved changes
              {dirtyActions.publish && hasErrors
                ? ', fix the invalid fields before publishing'
                : ''}
            </DashboardModalContent>
            <DashboardModalFooter>
              <Button
                onClick={discardAndConfirm}
                variant="ghost"
                icon={IcRoundUndo}
              >
                Discard
              </Button>
              <div className={styles.EntryEditorContent.navigationActions()}>
                {dirtyActions.publish && (
                  <Button
                    onClick={publishAndConfirm}
                    color={canSaveDraft ? 'secondary' : 'primary'}
                    icon={IcRoundCheck}
                    disabled={hasErrors}
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
