import {Button} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {memo, PropsWithChildren, useEffect, useTransition} from 'react'
import {
  Dashboard,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  ReactiveNode
} from '../store/Dashboard.js'
import {
  EditorScope,
  EntryScope,
  useDashboard,
  useEditor,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../store/hooks.js'
import {DetailsBar} from './DetailsBar.js'
import css from './Editor.module.css'
import {EditorBackButton} from './EditorBackButton.js'
import {FileEditor} from './editor/FileEditor.js'
import {EntryHeader} from './EntryHeader.js'
import {EntrySidebar} from './EntrySidebar.js'
import {Explorer} from './Explorer.js'
import {Rail, RailBody, RailFooter, RailHeader} from './ui/Rail.js'
import {Sheet, SheetContent, SheetDialog, SheetFooter} from './ui/Sheet.js'

const styles = styler(css)

export interface EditorProps {
  dashboard: Dashboard
}

export function Editor({dashboard}: EditorProps) {
  const focused = useAtomValue(dashboard.focused)
  if (!focused) return <Rail main />
  if ('entry' in focused) return <EntryEditor entry={focused.entry} />
  return <RootEditor root={focused.root} />
}

interface RootEditorProps {
  root: DashboardRoot
}

function RootEditor({root}: RootEditorProps) {
  const title = useAtomValue(root.label)
  const location = useAtomValue(root.explorer.location)
  return (
    <Rail main>
      <RailHeader className={styles.RootEditor.header()}>
        {location.parentId && (
          <RootEditorBackButton root={root} parentId={location.parentId} />
        )}
        <h1 className={styles.RootEditor.title()}>{title}</h1>
      </RailHeader>

      <Explorer explorer={root.explorer} />
    </Rail>
  )
}

interface RootEditorBackButtonProps {
  root: DashboardRoot
  parentId: string
}

function RootEditorBackButton({root, parentId}: RootEditorBackButtonProps) {
  const parent = useAtomValue(root.workspace.dashboard.entries(parentId))
  const parentParentId = useAtomValue(parent.parentId)
  const setLocation = useSetAtom(root.explorer.location)
  const nextParentId = parentParentId ?? undefined
  return (
    <EditorBackButton
      label={parentParentId ? 'Back to parent entry' : 'Back to root'}
      onPress={() => {
        setLocation(location => ({
          ...location,
          parentId: nextParentId
        }))
      }}
    />
  )
}

interface EntryEditorProps {
  entry: DashboardEntry
}

function EntryEditor({entry}: EntryEditorProps) {
  const isUntranslated = useAtomValue(entry.untranslated)
  const node = useAtomValue(entry.selectedNode)
  const setEditing = useSetAtom(entry.currentlyEditing)
  const type = useAtomValue(entry.type)
  const [isPending, startTransition] = useTransition()
  const save = useSetAtom(entry.saveDraft)
  const isDirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(entry.routeBlock)
  const status = useAtomValue(entry.activeStatus)

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
    setEditing(isDirty ? node : undefined)
  }, [node, setEditing, isDirty])

  let editorBody = (
    <>
      <DetailsBar status={status} />

      <RailBody className={styles.EntryEditor.body()}>
        <NodeEditor node={node} type={type.type} />
      </RailBody>
    </>
  )

  const isMediaFile = type.type === MediaFile
  if (isMediaFile) {
    editorBody = (
      <RailBody className={styles.EntryEditor.body()}>
        <NodeEditor node={node} type={type.type}>
          <FileEditor entry={entry} />
        </NodeEditor>
      </RailBody>
    )
  }

  const mainEditor = (
    <Rail main>
      <EntryHeader entry={entry} node={node} />

      {editorBody}

      <RailFooter
        id="alinea-toolbar"
        className={styles.EntryEditor.toolbar()}
      />
    </Rail>
  )

  return (
    <>
      <Sheet
        isOpen={Boolean(routeBlock)}
        onOpenChange={open => !open && setRouteBlock(null)}
      >
        {routeBlock && (
          <SheetDialog label="Confirm navigation">
            <SheetContent>This entry has unsaved changes</SheetContent>
            <SheetFooter>
              <Button intent="warning" onPress={discardAndConfirm}>
                Discard my changes
              </Button>
              <Button onPress={saveAndConfirm}>Save as draft</Button>
            </SheetFooter>
          </SheetDialog>
        )}
      </Sheet>
      <EntryScope entry={entry}>
        {mainEditor}
        {!isUntranslated && !isMediaFile && <EntrySidebar entry={entry} />}
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

const EditField = memo(function EditField({field}: EditFieldProps) {
  const options = useFieldOptions(field) as FieldLayoutOptions
  const View = useFieldView(field)
  if (options.hidden) return null
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
