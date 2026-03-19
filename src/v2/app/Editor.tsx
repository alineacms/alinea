import {Icon} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Field} from 'alinea/core/Field'
import {Section} from 'alinea/core/Section'
import {useAtomValue} from 'jotai'
import {memo} from 'react'
import {
  Dashboard,
  DashboardEditor,
  DashboardEntry,
  DashboardRoot,
  DashboardSection,
  DashboardType
} from '../store/Dashboard.js'
import {EditorScope, EntryScope, useFieldView} from '../store/hooks.js'
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

const TypeForm = memo(function TypeForm({editor}: TypeFormProps) {
  const value = useAtomValue(editor.value)
  return (
    <>
      {editor.sections.map((section, index) => {
        return <FormSection key={index} section={section} />
      })}
      <pre>{JSON.stringify(value)}</pre>
    </>
  )
})

interface FormSectionProps {
  section: DashboardSection
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  const props = {section: section.section}
  if (View) return <View {...props} />
  return (
    <div style={{display: 'contents'}}>
      <EditFields fields={Section.fields(section.section)} />
    </div>
  )
})

export interface EditFieldsProps {
  fields: Record<string, Field>
}

export const EditFields = memo(function EditFields({fields}: EditFieldsProps) {
  return Object.entries(fields).map(([name, field]) => {
    return <EditField key={name} field={field} />
  })
})

interface EditFieldProps {
  field: Field
}

const EditField = memo(function EditField({field}: EditFieldProps) {
  const View = useFieldView(field)
  if (!View) return <div>Missing view for field</div>
  return <View field={field} />
})

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
