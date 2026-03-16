import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {useAtomValue} from 'jotai'
import {
  Dashboard,
  DashboardEntry,
  DashboardRoot,
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
  return (
    <>
      <header className={styles.mainHeader()}>
        <h1 className={styles.mainTitle()}>{title}</h1>
        <TypeBadge type={entry.type} />
      </header>

      <div className={styles.mainBody()}>
        <TypeForm type={entry.type} />
      </div>
    </>
  )
}

interface TypeFormProps {
  type: DashboardType
}

function TypeForm({type}: TypeFormProps) {
  const sections = useAtomValue(type.sections)
  return sections.map((section, index) => {
    return (
      <div key={index} style={{display: 'contents'}}>
        <EditFields fields={Section.fields(section)} />
      </div>
    )
  })
}

interface FieldsProps {
  fields: Record<string, Field>
}

function EditFields({fields}: FieldsProps) {
  return Object.entries(fields).map(([name, field]) => {
    return <EditField key={name} name={name} field={field} />
  })
}

interface EditFieldProps {
  name: string
  field: Field
}

function EditField({name, field}: EditFieldProps) {
  return (
    <div>
      <label>{name}</label>
      <input />
    </div>
  )
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
