import {Button, Icon} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {RootData} from '#/core/Root.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {
  type ComponentType,
  memo,
  PropsWithChildren,
  useEffect,
  useState,
  useTransition
} from 'react'
import {
  EditorScope,
  EntryScope,
  useDashboard,
  useEditor,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../hooks.js'
import {
  IcBaselineErrorOutline,
  IcOutlineViewList,
  IcRoundEdit
} from '../icons.js'
import {
  Dashboard,
  DashboardEntryData,
  DashboardRoot,
  DashboardSection,
  ReactiveNode
} from '../store/Dashboard.js'
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
  dashboard: Dashboard
}

export function Editor({dashboard}: EditorProps) {
  const focused = useAtomValue(dashboard.focused)
  if (!focused) return <Rail main />
  if ('entry' in focused) return <EntryEditor entry={focused.entry} />
  if ('missingEntry' in focused)
    return (
      <MissingEntry
        dashboard={dashboard}
        entryId={focused.missingEntry}
        root={focused.root}
      />
    )
  if ('missingRoot' in focused)
    return (
      <MissingRoot
        dashboard={dashboard}
        rootKey={focused.missingRoot}
        root={focused.root}
      />
    )
  return <RootEditor root={focused.root} />
}

interface MissingEntryProps {
  dashboard: Dashboard
  entryId: string
  root: DashboardRoot
}

function MissingEntry({dashboard, entryId, root}: MissingEntryProps) {
  const rootLabel = useAtomValue(root.label)
  const route = useAtomValue(dashboard.route)
  const setRoute = useSetAtom(dashboard.route)
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
  dashboard: Dashboard
  rootKey: string
  root: DashboardRoot
}

function MissingRoot({dashboard, rootKey, root}: MissingRootProps) {
  const rootLabel = useAtomValue(root.label)
  const route = useAtomValue(dashboard.route)
  const setRoute = useSetAtom(dashboard.route)
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
        <div className={styles.MissingEntry.card()}>
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
        </div>
      </RailBody>
    </Rail>
  )
}

interface RootEditorProps {
  root: DashboardRoot
}

function RootEditor({root}: RootEditorProps) {
  const View = useAtomValue(root.view)
  if (View) return <CustomRootEditor root={root} view={View} />
  return <DefaultRootEditor root={root} />
}

interface CustomRootEditorProps {
  root: DashboardRoot
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

function DefaultRootEditor({root}: RootEditorProps) {
  const route = useAtomValue(root.workspace.dashboard.route)
  return (
    <Rail main>
      <Explorer
        explorer={root.explorer}
        titleControls={
          route.entry ? <RootOverviewControls root={root} /> : undefined
        }
      />
    </Rail>
  )
}

function RootOverviewControls({root}: RootEditorProps) {
  const entryId = useAtomValue(root.workspace.dashboard.route).entry
  if (!entryId) return null
  return <LoadedRootOverviewControls entryId={entryId} root={root} />
}

interface LoadedRootOverviewControlsProps {
  entryId: string
  root: DashboardRoot
}

function LoadedRootOverviewControls({
  entryId,
  root
}: LoadedRootOverviewControlsProps) {
  const entry = root.workspace.dashboard.entries(entryId)
  const {data} = useAtomValue(entry.data)
  if (!data) return null
  return <RootOverviewControlsButton entry={data} />
}

interface RootOverviewControlsButtonProps {
  entry: DashboardEntryData
}

function RootOverviewControlsButton({entry}: RootOverviewControlsButtonProps) {
  const defaultView = useAtomValue(entry.defaultView)
  const view = useAtomValue(entry.view)
  if (defaultView !== 'overview') return null
  if (view !== 'overview') return null
  return <EntryViewToggle entry={entry} />
}

interface EntryEditorProps {
  entry: DashboardEntryData
}

interface EntryViewToggleProps {
  entry: DashboardEntryData
}

function EntryViewToggle({entry}: EntryViewToggleProps) {
  const view = useAtomValue(entry.view)
  const setView = useSetAtom(entry.view)
  const [isPending, startTransition] = useTransition()
  const nextView = view === 'overview' ? 'edit' : 'overview'
  const label = nextView === 'overview' ? 'Show overview' : 'Edit entry'
  const ViewIcon = nextView === 'overview' ? IcOutlineViewList : IcRoundEdit
  return (
    <Button
      aria-label={label}
      appearance="plain"
      icon={ViewIcon}
      isDisabled={isPending}
      size="icon"
      onPress={() => {
        startTransition(() => {
          setView(nextView)
        })
      }}
    />
  )
}

function EntryEditor({entry}: EntryEditorProps) {
  const View = useAtomValue(entry.customView)
  const isUntranslated = useAtomValue(entry.untranslated)
  const node = useAtomValue(entry.selectedNode)
  const setEditing = useSetAtom(entry.currentlyEditing)
  const type = useAtomValue(entry.type)
  const [, startTransition] = useTransition()
  const save = useSetAtom(entry.saveDraft)
  const isDirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(entry.routeBlock)
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const defaultView = useAtomValue(entry.defaultView)

  const discardAndConfirm = () => {
    startTransition(() => {
      reset()
      routeBlock?.confirm()
    })
  }

  const saveAndConfirm = () => {
    startTransition(() => {
      save(node)
      routeBlock?.confirm()
    })
  }

  useEffect(() => {
    if (node.readOnly && !isUntranslated) return
    setEditing(isUntranslated || isDirty ? node : undefined)
  }, [isDirty, isUntranslated, node, setEditing])

  let editorBody = (
    <>
      <RailBody className={styles.EntryEditor.body()}>
        <RailContent>
          {isUntranslated && (
            <div className={styles.EntryEditor.banner()}>
              <EntryTranslationBanner entry={entry} />
            </div>
          )}

          <NodeEditor node={node} type={type.type} />
        </RailContent>
      </RailBody>
    </>
  )

  const isMediaFile = type.type === MediaFile
  if (isMediaFile) {
    editorBody = (
      <>
        <RailBody className={styles.EntryEditor.body()}>
          <RailContent>
            <NodeEditor node={node} type={type.type}>
              <FileEditor entry={entry} />
            </NodeEditor>
          </RailContent>
        </RailBody>
      </>
    )
  }

  if (View) {
    return <View type={type.type} />
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
                Save as draft
              </Button>
            </DashboardModalFooter>
          </DashboardModalDialog>
        )}
      </DashboardModal>
      <EntryScope entry={entry}>
        {mainEditor}
        {hasSidebar && isSidebarOpen && (
          <EntrySidebar entry={entry} onOpenChange={setSidebarOpen} />
        )}
      </EntryScope>
    </>
  )
}

interface NodeEditorProps extends PropsWithChildren {
  node: ReactiveNode<object>
  type: Type
}

export function NodeEditor({
  children = <FieldsEditor />,
  node,
  type
}: NodeEditorProps) {
  const editor = useNodeEditor(node, type)
  return <EditorScope editor={editor}>{children}</EditorScope>
}

export function FieldsEditor() {
  const editor = useEditor()
  return editor.sections.map((section, index) => {
    return <FormSection key={index} section={section} />
  })
}

interface FormSectionProps {
  section: DashboardSection
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
  const dashboard = useDashboard()
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
              <FormSection section={new DashboardSection(dashboard, value)} />
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
