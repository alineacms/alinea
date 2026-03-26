import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {ErrorMessage} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {memo} from 'react'
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
  useFieldView,
  useNodeEditor
} from '../store/hooks.js'
import css from './Editor.module.css'
import {EntrySidebar} from './EntrySidebar.js'
import {Explorer} from './Explorer.js'
import {Rail, RailHeader} from './ui/Rail.js'

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
    <Rail>
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
  return (
    <EntryScope entry={entry}>
      <EditorScope editor={editor}>
        <Rail main>
          <RailHeader>
            <h1 className={styles.mainTitle()}>{title}</h1>
            <TypeBadge type={type} />
          </RailHeader>

          <div className={`${styles.mainBody()} ${styles.entryMainBody()}`}>
            <FieldsEditor editor={editor} />
          </div>
        </Rail>

        <EntrySidebar />
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

const EditField = memo(function EditField({field}: EditFieldProps) {
  const View = useFieldView(field)
  if (!View)
    return (
      <ErrorMessage error={`Missing view for field: ${Field.label(field)}`} />
    )
  return <View field={field} />
})

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
