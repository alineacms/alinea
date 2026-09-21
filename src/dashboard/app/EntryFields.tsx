import {Surface, SurfaceContent} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import type {Type} from '#/core/Type.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {createContext, memo, type PropsWithChildren, useContext} from 'react'
import type {EditorNode} from '../atoms/editor.js'
import {EntryEditorSection, type EditorSection} from '../atoms/editor.js'
import {
  EditorScope,
  useEditor,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../hooks.js'
import css from './EntryFields.module.css'

const styles = styler(css)

interface NodeEditorProps extends PropsWithChildren {
  initiallyExpandDisclosures?: boolean
  node: EditorNode
  readOnly?: boolean
  type: Type
}

const InitiallyExpandDisclosuresContext = createContext(false)

export function NodeEditor({
  children,
  initiallyExpandDisclosures = false,
  node,
  readOnly,
  type
}: NodeEditorProps) {
  const editor = useNodeEditor(node, type, readOnly)
  return (
    <EditorScope editor={editor}>
      <InitiallyExpandDisclosuresContext.Provider
        value={initiallyExpandDisclosures}
      >
        {children ?? <FieldsEditor />}
      </InitiallyExpandDisclosuresContext.Provider>
    </EditorScope>
  )
}

export function useInitiallyExpandDisclosures() {
  return useContext(InitiallyExpandDisclosuresContext)
}

export function FieldsEditor() {
  const editor = useEditor()
  return editor.sections.map((section, index) => (
    <FormSection key={index} section={section} />
  ))
}

export function EntryFields() {
  const editor = useEditor()
  return editor.sections.map((section, index) => (
    <EntryFormSection key={index} section={section} />
  ))
}

interface FormSectionProps {
  section: EditorSection
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValueRaw(section.view)
  if (View) return <View section={section.section} />
  return <EditFields fields={Section.definition(section.section)} />
})

const EntryFormSection = memo(function EntryFormSection({
  section
}: FormSectionProps) {
  const fields = <FormSection section={section} />
  if (Section.view(section.section)) return fields
  return (
    <Surface>
      <SurfaceContent>{fields}</SurfaceContent>
    </Surface>
  )
})

export interface EditFieldsProps {
  fields: Record<string, Field | Section>
}

export const EditFields = memo(function EditFields({fields}: EditFieldsProps) {
  return (
    <div className={styles.EditFields()}>
      {Object.entries(fields).map(([name, value]) => {
        if (Field.isField(value)) return <EditField key={name} field={value} />
        if (!Section.isSection(value)) return null
        return (
          <div
            key={name}
            className={styles.EditField.slot()}
            style={{flexBasis: fieldWidth()}}
          >
            <FormSection section={new EntryEditorSection(value)} />
          </div>
        )
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
  if (options.hidden || field instanceof HiddenField) return null
  if (!View) return <div>Missing view for field: {Field.label(field)}</div>
  return (
    <div
      className={styles.EditField.slot()}
      style={{flexBasis: fieldWidth(options.width)}}
    >
      <View field={field} />
    </div>
  )
})

export function fieldWidth(width = 1): string {
  const fraction = Math.max(0, Math.min(1, width))
  if (fraction === 0) return '0px'
  if (fraction === 1) return '100%'
  return `calc(${fraction * 100}% - var(--alinea-field-gap) * ${1 - fraction})`
}
