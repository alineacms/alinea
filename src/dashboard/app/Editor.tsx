import {useAtomValue} from '../AtomHooks.js'
import {Button, Icon, Surface} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {Resource} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Section} from '#/core/Section.js'
import type {Type} from '#/core/Type.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useSetAtom} from 'jotai'
import {type ComponentType, memo, PropsWithChildren, useEffect} from 'react'
import {EditorScope, useEditor, useNodeEditor} from '../editor/EditorScope.js'
import {useFieldOptions, useFieldView} from '../editor/FieldHooks.js'
import {EntryScope} from '../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit
} from '../icons.js'
import {
  createSection,
  ReactiveNode,
  type SectionAtoms
} from '../atoms/entry/editor.js'
import {entryAtoms, type EntryDataAtoms} from '../atoms/entry.js'
import {entrySidebarOpenAtom, type EntryPageData} from '../atoms/entry/load.js'
import type {ExplorerPageData} from '../atoms/explorer.js'
import {
  type LoadedRoute,
  routeAtom,
  type RootPageData
} from '../atoms/routing.js'
import type {RootAtoms} from '../atoms/config.js'
import css from './Editor.module.css'
import {FileEditor} from './editor/FileEditor.js'
import {EntryHeader} from './EntryHeader.js'
import {EntrySidebar} from './EntrySidebar.js'
import {EntryTranslationBanner} from './EntryTranslationBanner.js'
import {Explorer} from './Explorer.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'
import {Rail, RailBody, RailContent} from './ui/Rail.js'

const styles = styler(css)
export interface EditorProps {
  page: LoadedRoute
}

export function Editor({page}: EditorProps) {
  if (page.type === 'entry') return <EntryEditor page={page} />
  if (page.type === 'missing-entry')
    return <MissingEntry entryId={page.entryId} root={page.root} />
  if (page.type === 'missing-root')
    return <MissingRoot rootKey={page.rootKey} root={page.root} />
  if (page.type === 'root') return <RootEditor page={page} />
  if (page.type === 'explorer') return <ExplorerEditor page={page} />
  return <Rail main />
}

interface MissingEntryProps {
  entryId: string
  root: RootAtoms
}

function MissingEntry({entryId, root}: MissingEntryProps) {
  const rootLabel = useAtomValue(root.settings).label
  const route = useAtomValue(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  return (
    <NotFoundPanel
      title="Entry not found"
      message="The requested entry could not be found. It may have been deleted, moved, or is no longer available."
      requestedLabel="Requested id"
      requestedValue={entryId}
      actionLabel={`Go to ${rootLabel}`}
      onAction={() =>
        setRoute({
          workspace: root.workspace.key,
          root: root.key,
          locale: route.locale
        })
      }
    />
  )
}

interface MissingRootProps {
  rootKey: string
  root: RootAtoms
}

function MissingRoot({rootKey, root}: MissingRootProps) {
  const rootLabel = useAtomValue(root.settings).label
  const route = useAtomValue(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  return (
    <NotFoundPanel
      title="Root not found"
      message="The requested root could not be found in this workspace. It may have been renamed, removed, or moved."
      requestedLabel="Requested root"
      requestedValue={rootKey}
      actionLabel={`Go to ${rootLabel}`}
      onAction={() =>
        setRoute({
          workspace: root.workspace.key,
          root: root.key,
          locale: route.locale
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

interface LoadedRootEditorProps {
  page: RootPageData
}

function RootEditor({page}: LoadedRootEditorProps) {
  const View = useAtomValue(page.root.view)
  if (!View) return <Rail main />
  return <CustomRootEditor root={page.root} view={View} />
}

interface ExplorerEditorProps {
  page: ExplorerPageData
}

function ExplorerEditor({page}: ExplorerEditorProps) {
  const {root} = page
  const View = useAtomValue(root.view)
  if (View) return <CustomRootEditor root={root} view={View} />
  return <DefaultRootEditor page={page} />
}

interface CustomRootEditorProps {
  root: RootAtoms
  view: ComponentType<{root: RootData}>
}

function CustomRootEditor({root, view: View}: CustomRootEditorProps) {
  const rootData = useAtomValue(root.data)
  return (
    <Rail main>
      <RailBody className={styles.RootEditor.customView()}>
        <View root={rootData} />
      </RailBody>
    </Rail>
  )
}

function DefaultRootEditor({page}: ExplorerEditorProps) {
  const {root} = page
  const route = useAtomValue(routeAtom)
  return (
    <Rail main>
      <Explorer
        explorer={root.explorer}
        items={page.snapshot.items}
        titleControls={route.entry ? <RootOverviewControls /> : undefined}
      />
    </Rail>
  )
}

function RootOverviewControls() {
  const entryId = useAtomValue(routeAtom).entry
  if (!entryId) return null
  return <LoadedRootOverviewControls entryId={entryId} />
}

interface LoadedRootOverviewControlsProps {
  entryId: string
}

function LoadedRootOverviewControls({
  entryId
}: LoadedRootOverviewControlsProps) {
  const entry = entryAtoms(entryId)
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return <RootOverviewControlsButton entry={data} />
}

interface RootOverviewControlsButtonProps {
  entry: EntryDataAtoms
}

function RootOverviewControlsButton({entry}: RootOverviewControlsButtonProps) {
  const defaultView = useAtomValue(entry.defaultView)
  const view = useAtomValue(entry.view)
  if (defaultView !== 'overview') return null
  if (view !== 'overview') return null
  return <EntryViewToggle entry={entry} />
}

interface EntryEditorProps {
  page: EntryPageData
}

interface EntryViewToggleProps {
  entry: EntryDataAtoms
}

function EntryViewToggle({entry}: EntryViewToggleProps) {
  const view = useAtomValue(entry.view)
  const setView = useSetAtom(entry.view)
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

function EntryEditor({page}: EntryEditorProps) {
  return (
    <EntryScope entry={page.currentEntry}>
      <EntryEditorContent page={page} />
    </EntryScope>
  )
}

function EntryEditorContent({page}: EntryEditorProps) {
  const {entry, node} = page
  const View = useAtomValue(entry.customView)
  const isUntranslated = useAtomValue(entry.untranslated)
  const setEditing = useSetAtom(entry.currentlyEditing)
  const type = useAtomValue(entry.type)
  const saveDraft = useSetAtom(entry.saveDraft)
  const publishEdits = useSetAtom(entry.publishEdits)
  const reset = useSetAtom(node.reset)
  const routeBlock = useAtomValue(entry.routeBlock)
  const isSidebarOpen = page.sidebar.open
  const setSidebarOpen = useSetAtom(entrySidebarOpenAtom)
  const defaultView = useAtomValue(entry.defaultView)
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const mediaDraftsDisabled = isMediaFile || isMediaLibrary

  const discardAndConfirm = () => {
    reset()
    routeBlock?.confirm()
  }

  const saveAndConfirm = async () => {
    if (mediaDraftsDisabled) {
      await publishEdits(node)
    } else {
      await saveDraft(node)
    }
    routeBlock?.confirm()
  }

  useEffect(() => {
    setEditing(node.readOnly && !isUntranslated ? undefined : node)
  }, [isUntranslated, node, setEditing])

  let editorBody = (
    <>
      <RailBody className={styles.EntryEditor.body()}>
        <RailContent>
          {isUntranslated && (
            <div className={styles.EntryEditor.banner()}>
              <EntryTranslationBanner entry={entry} page={page} />
            </div>
          )}

          <NodeEditor
            node={node}
            resource={page.activeVersion ?? undefined}
            type={type}
          />
        </RailContent>
      </RailBody>
    </>
  )

  if (isMediaFile) {
    editorBody = (
      <>
        <RailBody className={styles.EntryEditor.body()}>
          <NodeEditor
            node={node}
            resource={page.activeVersion ?? undefined}
            type={type}
          >
            <FileEditor />
          </NodeEditor>
        </RailBody>
      </>
    )
  }

  if (View) {
    return <View type={type} />
  }

  const hasSidebar = !isUntranslated

  const mainEditor = (
    <Rail main>
      <EntryHeader
        controls={
          defaultView === 'overview' ? (
            <EntryViewToggle entry={entry} />
          ) : undefined
        }
        entry={entry}
        page={page}
        isSidebarOpen={isSidebarOpen}
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
        onOpenChange={open => !open && routeBlock?.cancel()}
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
      {mainEditor}
      {hasSidebar && isSidebarOpen && (
        <EntrySidebar entry={entry} page={page} onOpenChange={setSidebarOpen} />
      )}
    </>
  )
}

interface NodeEditorProps extends PropsWithChildren {
  node: ReactiveNode<object>
  resource?: Resource
  type: Type
}

export function NodeEditor({
  children = <FieldsEditor />,
  node,
  resource,
  type
}: NodeEditorProps) {
  const editor = useNodeEditor(node, type, resource)
  return <EditorScope editor={editor}>{children}</EditorScope>
}

export function FieldsEditor() {
  const editor = useEditor()
  return editor.sections.map((section, index) => {
    return <FormSection key={index} section={section} />
  })
}

interface FormSectionProps {
  section: SectionAtoms
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {section: section.section}
  if (View) return <View {...props} />
  return <EditFields fields={Section.definition(section.section)} />
})

export interface EditFieldsProps {
  fields: Record<string, Field | Section>
}

export const EditFields = memo(function EditFields({fields}: EditFieldsProps) {
  return (
    <div className={styles.EditFields()}>
      {Object.entries(fields).map(([name, value]) => {
        if (Field.isField(value)) return <EditField key={name} field={value} />
        if (Section.isSection(value))
          return (
            <div
              key={name}
              className={styles.EditField.slot()}
              style={{gridColumn: `span ${fieldSpan()}`}}
            >
              <FormSection section={createSection(value)} />
            </div>
          )
        return null
      })}
    </div>
  )
})

interface EditFieldProps {
  field: Field
}

interface FieldLayoutOptions extends FieldOptions<unknown> {
  width?: number
}

export const EditField = memo(function EditField({field}: EditFieldProps) {
  const options = useFieldOptions(field) as FieldLayoutOptions
  const View = useFieldView(field)
  if (options.hidden) return null
  if (field instanceof HiddenField) return null
  if (!View) return <div>Missing view for field: {Field.label(field)}</div>
  return (
    <div
      className={styles.EditField.slot()}
      style={{gridColumn: `span ${fieldSpan(options.width)}`}}
    >
      <View field={field} />
    </div>
  )
})

function fieldSpan(width = 1): number {
  const columns = 12
  return Math.max(1, Math.min(columns, Math.round(width * columns)))
}
