import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {assert} from 'alinea/core/util/Assert'
import {ErrorBoundary} from 'alinea/dashboard/view/ErrorBoundary.js'
import {useAtomValue} from 'jotai'
import {
  Dashboard,
  DashboardEditor,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  DashboardType
} from '../dashboard/Dashboard.js'
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
  return (
    <>
      <header className={styles.mainHeader()}>
        <h1 className={styles.mainTitle()}>{title}</h1>
        <TypeBadge type={entry.type} />
      </header>

      <div className={styles.mainBody()}>
        <TypeForm editor={editor} />
      </div>
    </>
  )
}

interface TypeFormProps {
  editor: DashboardEditor
}

function TypeForm({editor}: TypeFormProps) {
  return editor.sections.map((section, index) => {
    return <FormSection key={index} editor={editor} section={section} />
  })
}

interface FormSectionProps {
  editor: DashboardEditor
  section: DashboardSection
}

function FormSection({editor, section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {editor, section: section.section}
  if (View) return <View {...props} />
  return (
    <div style={{display: 'contents'}}>
      <EditFields editor={editor} fields={Section.fields(section.section)} />
    </div>
  )
}

export interface EditFieldsProps {
  editor: DashboardEditor
  fields: Record<string, Field>
}

export function EditFields({editor, fields}: EditFieldsProps) {
  return Object.entries(fields).map(([name, field]) => {
    return (
      <ErrorBoundary key={name}>
        <EditField editor={editor} name={name} field={field} />
      </ErrorBoundary>
    )
  })
}

interface EditFieldProps {
  name: string
  editor: DashboardEditor
  field: Field
}

function EditField({editor, name, field}: EditFieldProps) {
  const info = editor.field[name]
  assert(info, 'Missing editor info for field')
  const View = useAtomValue(info.view)
  const props = {editor, field, name}
  return <View {...props} />
}

interface TypeBadgeProps {
  type: DashboardType
}

function TypeBadge({type}: TypeBadgeProps) {
  const label = useAtomValue(type.label)
  const icon = useAtomValue(type.icon)
  return (
    <span>
      <Icon icon={icon} />
      {label}
    </span>
  )
}
