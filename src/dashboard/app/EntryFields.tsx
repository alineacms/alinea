import {Surface, SurfaceContent} from '#/components.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import type {ObjectField} from '#/field/object.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {memo} from 'react'
import {EntryEditorSection, type EditorSection} from '../atoms/editor.js'
import {
  EditorScope,
  useEditor,
  useFieldNode,
  useFieldOptions,
  useFieldView,
  useNodeEditor
} from '../hooks.js'
import css from './EntryFields.module.css'

const styles = styler(css)

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
  /**
   * An object field to render the fields of, in the scope of its value.
   * Without `fields` all its fields are rendered.
   */
  field?: ObjectField<object>
  /** The fields and sections to render, keyed by name */
  fields?: Record<string, Field | Section>
}

/**
 * Renders a set of fields and sections with their configured views, laid out
 * like the default entry form (including each field's `width`).
 *
 * @example
 * // Some fields of an object field, in a custom view of that object
 * <EditFields
 *   field={Product.dimensions}
 *   fields={{width: Product.dimensions.width}}
 * />
 */
export const EditFields = memo(function EditFields({
  field,
  fields
}: EditFieldsProps) {
  if (field) return <ObjectFields field={field} fields={fields} />
  if (!fields) return null
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

interface ObjectFieldsProps {
  field: ObjectField<object>
  fields?: Record<string, Field | Section>
}

function ObjectFields({field, fields}: ObjectFieldsProps) {
  const type = useFieldOptions(field).fields
  const node = useFieldNode<object>(field)
  const editor = useNodeEditor(node, type)
  return (
    <EditorScope editor={editor}>
      {fields ? <EditFields fields={fields} /> : <FieldsEditor />}
    </EditorScope>
  )
}

export interface EditFieldProps {
  /** The field to render, it must belong to the entry, row or object being edited */
  field: Field
}

/**
 * Renders a field with its configured view, as the default entry form does.
 * Renders nothing for hidden fields.
 */
export const EditField = memo(function EditField({field}: EditFieldProps) {
  const options = useFieldOptions(field) as FieldOptions<unknown>
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
