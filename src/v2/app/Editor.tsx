import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {assert} from 'alinea/core/util/Assert'
import {ErrorBoundary} from 'alinea/dashboard/view/ErrorBoundary.js'
import {useAtomValue} from 'jotai'
import {
  Dashboard,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  DashboardType
} from '../dashboard/Dashboard.js'
import {EditorScope, EntryScope, useDashboardEditor} from '../dashboard/hooks.js'
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
    <EntryScope entry={entry}>
      <EditorScope editor={editor}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>{title}</h1>
          <TypeBadge type={entry.type} />
        </header>

        <div className={styles.mainBody()}>
          <TypeForm />
        </div>
      </EditorScope>
    </EntryScope>
  )
}

function TypeForm() {
  const editor = useDashboardEditor()
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
    return (
      <ErrorBoundary key={name}>
        <EditField name={name} field={field} />
      </ErrorBoundary>
    )
  })
}

interface EditFieldProps {
  name: string
  field: Field
}

function EditField({name, field}: EditFieldProps) {
  const editor = useDashboardEditor()
  const info = editor.field[name]
  assert(info, 'Missing editor info for field')
  const View = useAtomValue(info.view)
  const props = {field, name}
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
