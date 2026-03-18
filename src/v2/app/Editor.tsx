import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {useAtomValue} from 'jotai'
import {
  Dashboard,
  DashboardEditor,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  DashboardType
} from '../dashboard/Dashboard.js'
import {EditorScope, EntryScope, useFieldView} from '../dashboard/hooks.js'
import css from './Editor.module.css'

const styles = styler(css)

export interface EditorProps {
  dashboard: Dashboard
}

export function Editor({dashboard}: EditorProps) {
  const focused = useAtomValue(dashboard.focused)
  if (!focused) return null
  if ('entry' in focused) return <EntryEditor entry={focused.entry} />
  return <RootEditor root={focused.root} />
}

interface RootEditorProps {
  root: DashboardRoot
}

function RootEditor({root}: RootEditorProps) {
  const title = useAtomValue(root.label)
  return (
    <div>
      <h2>{title}</h2>
    </div>
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
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>{title}</h1>
          <TypeBadge type={type} />
        </header>

        <div className={styles.mainBody()}>
          <TypeForm editor={editor} />
        </div>
      </EditorScope>
    </EntryScope>
  )
}

interface TypeFormProps {
  editor: DashboardEditor
}

function TypeForm({editor}: TypeFormProps) {
  return editor.sections.map((section, index) => {
    return <FormSection key={index} section={section} />
  })
}

interface FormSectionProps {
  section: DashboardSection
}

function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {section: section.section}
  if (View) return <View {...props} />
  return (
    <div style={{display: 'contents'}}>
      <EditFields fields={Section.fields(section.section)} />
    </div>
  )
}

export interface EditFieldsProps {
  fields: Record<string, Field>
}

export function EditFields({fields}: EditFieldsProps) {
  return Object.entries(fields).map(([name, field]) => {
    return <EditField field={field} />
  })
}

interface EditFieldProps {
  field: Field
}

function EditField({field}: EditFieldProps) {
  const View = useFieldView(field)
  if (!View) return <div>Missing view for field</div>
  return <View field={field} />
}

interface TypeBadgeProps {
  type: DashboardType
}

function TypeBadge({type}: TypeBadgeProps) {
  const label = type.label
  const icon = type.icon
  return (
    <span>
      <Icon icon={icon} />
      {label}
    </span>
  )
}
