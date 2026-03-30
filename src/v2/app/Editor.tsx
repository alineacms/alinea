import {Button, Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field, type FieldOptions} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {ErrorMessage} from 'alinea/ui'
import {useAtomValue, useSetAtom} from 'jotai'
import {memo, useTransition} from 'react'
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
        <h1 className={styles.mainTitle()}>{title}</h1>
      </RailHeader>

      <div className={styles.explorerMainBody()}>
        <div className={styles.explorerBody()}>
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
  const editor = useAtomValue(entry.editor)
  const type = useAtomValue(entry.type)
  const [isPending, startTransition] = useTransition()
  const save = useSetAtom(entry.saveDraft)
  return (
    <EntryScope entry={entry}>
      <EditorScope editor={editor}>
        <Rail main>
          <RailHeader>
            <h1 className={styles.mainTitle()}>{title}</h1>
            <TypeBadge type={type} />
            <div style={{marginLeft: 'auto'}}>
              <Button
                isPending={isPending}
                onPress={() => startTransition(save)}
              >
                {isPending ? 'Saving...' : 'Save Draft'}
              </Button>
            </div>
          </RailHeader>

          <RailBody>
            <FieldsEditor editor={editor} />

            <RailFooter id="alinea-toolbar" className={styles.toolbar()} />
          </RailBody>
        </Rail>

        <EntrySidebar entry={entry} />
      </EditorScope>
    </EntryScope>
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
    <div className={styles.fields()}>
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
  if (!View)
    return (
      <ErrorMessage error={`Missing view for field: ${Field.label(field)}`} />
    )
  return (
    <div
      className={styles.fieldSlot()}
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
    <span className={styles.typeBadge()}>
      {icon && <Icon icon={icon} />}
      {label}
    </span>
  )
}
