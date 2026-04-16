import {Field, type FieldOptions} from '#/core/Field'
import {Section} from '#/core/Section'
import {Type} from '#/core/Type'
import {Button, Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {memo, useEffect, useTransition} from 'react'
import {
  Dashboard,
  DashboardEditor,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  DashboardType,
  ReactiveNode
} from '../store/Dashboard.js'
import {
  EditorScope,
  EntryScope,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../store/hooks.js'
import css from './Editor.module.css'
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
  return (
    <Rail main>
      <RailHeader>
        <h1 className={styles.RootEditor.title()}>{title}</h1>
      </RailHeader>

      <div className={styles.RootEditor.body()}>
        <div className={styles.RootEditor.explorer()}>
          <Explorer explorer={root.explorer} />
        </div>
      </div>
    </Rail>
  )
}

interface EntryEditorProps {
  entry: DashboardEntry
}

function EntryEditor({entry}: EntryEditorProps) {
  const title = useAtomValue(entry.label)
  const isUntranslated = useAtomValue(entry.untranslated)
  const node = useAtomValue(entry.selectedNode)
  const setEditing = useSetAtom(entry.currentlyEditing)
  const type = useAtomValue(entry.type)
  const [isPending, startTransition] = useTransition()
  const save = useSetAtom(entry.saveDraft)
  const isDirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const [routeBlock, setRouteBlock] = useAtom(entry.routeBlock)

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

  const mainEditor = (
    <Rail main>
      <RailHeader className={styles.EntryEditor.header()}>
        <div>
          <h1 className={styles.EntryEditor.title()}>{title}</h1>
          <TypeBadge type={type} />
        </div>
        <EntryStatus entry={entry} />
        {isDirty && (
          <div style={{marginLeft: 'auto'}}>
            <Button intent="secondary" onPress={reset}>
              Discard my changes
            </Button>
            <Button
              isPending={isPending}
              onPress={() => startTransition(() => save(node))}
            >
              {isPending ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        )}
      </RailHeader>

      <RailBody className={styles.EntryEditor.body()}>
        <NodeEditor node={node} type={type.type} />
        <RailFooter
          id="alinea-toolbar"
          className={styles.EntryEditor.toolbar()}
        />
      </RailBody>
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
        {!isUntranslated && <EntrySidebar entry={entry} />}
      </EntryScope>
    </>
  )
}

interface NodeEditorProps {
  node: ReactiveNode<object>
  type: Type
}

export function NodeEditor({node, type}: NodeEditorProps) {
  const editor = useNodeEditor(node, type)
  return (
    <EditorScope editor={editor}>
      <FieldsEditor editor={editor} />
    </EditorScope>
  )
}

interface FieldsEditorProps {
  editor: DashboardEditor
}

export const FieldsEditor = memo(function TypeForm({
  editor
}: FieldsEditorProps) {
  return editor.sections.map((section, index) => {
    return <FormSection key={index} section={section} />
  })
})

interface FormSectionProps {
  section: DashboardSection
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {section: section.section}
  if (View) return <View {...props} />
  return <EditFields fields={Section.fields(section.section)} />
})

export interface EditFieldsProps {
  fields: Record<string, Field>
}

export const EditFields = memo(function EditFields({fields}: EditFieldsProps) {
  return (
    <div className={styles.EditFields()}>
      {Object.entries(fields).map(([name, field]) => {
        return <EditField key={name} field={field} />
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

interface TypeBadgeProps {
  type: DashboardType
}

function TypeBadge({type}: TypeBadgeProps) {
  const label = type.label
  const icon = type.icon
  return (
    <span className={styles.TypeBadge()}>
      {icon && <Icon icon={icon} />}
      {label}
    </span>
  )
}

interface EntryStatusProps {
  entry: DashboardEntry
}

function EntryStatus({entry}: EntryStatusProps) {
  const selectedVersion = useAtomValue(entry.selectedVersion)
  if (selectedVersion.type !== 'status') return
  return (
    <span className={styles.EntryStatus.badge()}>{selectedVersion.status}</span>
  )
}
