import {Button, Icon, Surface, Tooltip} from '#/components.js'
import type {Entry} from '#/core/Entry.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {typeAtoms} from '#/dashboard/atoms/config.js'
import {entrySidebarOpenAtom} from '#/dashboard/atoms/dashboard.js'
import type {ExplorerReadyPage} from '#/dashboard/atoms/explorer.js'
import {
  entryAtoms,
  MissingEntryError,
  type EntryAtoms,
  type EntryLocaleAtoms
} from '#/dashboard/atoms/entry.js'
import {
  Page,
  page,
  routeAtom,
  routeBlockAtom,
  routeGuardAtom
} from '#/dashboard/atoms/nav.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {rootAtoms, type RootAtoms} from '#/dashboard/atoms/root.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useLayoutEffect, useRef, useTransition} from 'react'
import {EntryScope} from '../../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit
} from '../../icons.js'
import {FileEditor} from './../editor/FileEditor.js'
import {CreateEntryButton} from './../DashboardLayout.js'
import {EntryFields, NodeEditor} from './../EntryFields.js'
import {EntryHeader} from './../EntryHeader.js'
import {
  EntrySidebar,
  entrySidebar,
  type EntrySidebarProps
} from './../EntrySidebar.js'
import {EntryTranslationBanner} from './../EntryTranslationBanner.js'
import {Explorer} from './../Explorer.js'
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
    const parentNeedsTranslation = type.customView
      ? false
      : await get(localeData.parentNeedsTranslation)
    const sourceLocale = get(localeData.translationSourceLocale)
    const sidebar = await entrySidebar(get, entry, localeData)
    return (
      <EntryEditorContent
        entry={entry}
        localeData={localeData}
        node={selectedNode}
        page={page}
        parentNeedsTranslation={parentNeedsTranslation}
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
  const root = useAtomValue(rootAtoms(page.workspace, page.root).data)
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
            <Button onPress={onAction}>{actionLabel}</Button>
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
  const entryView = useAtomValue(entry.view)
  const view = page.view ?? entryView
  const setRoute = useSetAtom(routeAtom)
  const [isPending, startTransition] = useTransition()
  const nextView = view === 'overview' ? 'edit' : 'overview'
  const label = nextView === 'overview' ? 'Show overview' : 'Edit entry'
  const tooltip = nextView === 'overview' ? 'Overview view' : 'Edit view'
  const ViewIcon = nextView === 'overview' ? IcOutlineViewList : IcRoundEdit
  return (
    <Tooltip delay={300} tooltip={tooltip}>
      <Button
        aria-label={label}
        appearance="plain"
        icon={ViewIcon}
        isDisabled={isPending}
        size="icon"
        onPress={() =>
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
  localeData: EntryLocaleAtoms
  parentNeedsTranslation: boolean
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
  localeData,
  parentNeedsTranslation,
  selectedEntry,
  sidebar,
  sourceLocale,
  node
}: EntryEditorContentProps) {
  const typeName = useAtomValue(entry.type)
  const type = useAtomValue(typeAtoms(typeName))
  const hasChildren = useAtomValue(entry.hasChildren)
  const defaultView = useAtomValue(entry.view)
  const sourceLocales = useAtomValue(entry.translationSourceLocales)
  const parentPaths = useAtomValue(entry.parentPaths)
  const View = type.customView
  const {locale} = page
  const isUntranslated = selectedEntry.locale !== locale
  const setEditing = useSetAtom(localeData.currentlyEditing)
  const setSourceLocale = useSetAtom(localeData.translationSourceLocale)
  const saveDraft = useSetAtom(localeData.saveDraft)
  const publishEdits = useSetAtom(localeData.publishEdits)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(routeBlockAtom)
  const setRouteGuard = useSetAtom(routeGuardAtom)
  const [isSidebarOpen, setSidebarOpen] = useAtom(entrySidebarOpenAtom)
  const editorBodyRef = useRef<HTMLDivElement>(null)
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
                parentNeedsTranslation={parentNeedsTranslation}
                sourceLocale={sourceLocale}
                sourceLocales={sourceLocales}
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
            <FileEditor entry={selectedEntry} parentPaths={parentPaths} />
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
      <EntryScope
        entry={entry}
        localeData={localeData}
        selectedEntry={selectedEntry}
      >
        {mainEditor}
        {sidebar && isSidebarOpen && (
          <EntrySidebar {...sidebar} onOpenChange={setSidebarOpen} />
        )}
      </EntryScope>
    </>
  )
}
