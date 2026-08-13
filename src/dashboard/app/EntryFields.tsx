import {Surface, SurfaceContent} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import type {Type} from '#/core/Type.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {memo, type PropsWithChildren} from 'react'
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
  node: EditorNode
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
  return editor.sections.map((section, index) => (
    <FormSection key={index} section={section} />
  ))
}

interface FormSectionProps {
  section: EditorSection
}

const FormSection = memo(function FormSection({section}: FormSectionProps) {
  const View = useAtomValue(section.view)
  if (View) return <View section={section.section} />
  return (
    <Surface>
      <SurfaceContent>
        <EditFields fields={Section.definition(section.section)} />
      </SurfaceContent>
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
            style={{gridColumn: `span ${fieldSpan()}`}}
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
