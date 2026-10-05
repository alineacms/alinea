import {Field, type FieldOptions} from '#/core/Field.js'
import {Section} from '#/core/Section.js'
import {HiddenField} from '#/field/hidden.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {memo} from 'react'
import {EntryEditorSection, type EditorSection} from '../atoms/editor.js'
import {useEditor, useFieldOptions, useFieldView} from '../hooks.js'
import css from './EntryFields.module.css'
import {InlineErrorBoundary} from './InlineErrorBoundary.js'

const styles = styler(css)

export function FieldsEditor() {
  const editor = useEditor()
  return editor.sections.map((section, index) => (
    <FormSection key={index} section={section} />
  ))
}

/** The fields of an entry, where fields outside of tabs get a container */
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
  return <div className={styles.EntryFields()}>{fields}</div>
})

export interface EditFieldsProps {
  /** The fields and sections to render, keyed by name */
  fields: Record<string, Field | Section>
}

/**
 * Renders a set of fields and sections with their configured views, laid out
 * like the default entry form (including each field's `width`).
 */
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

export interface EditFieldProps {
  /** The field to render, it must belong to the entry, row or object being edited */
  field: Field
}

interface FieldLayoutOptions extends FieldOptions<unknown> {
  width?: number
}

/**
 * Renders a field with its configured view, as the default entry form does.
 * Renders nothing for hidden fields.
 */
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
      <InlineErrorBoundary title={`Could not show ${Field.label(field)}`}>
        <View field={field} />
      </InlineErrorBoundary>
    </div>
  )
})

export function fieldWidth(width = 1): string {
  const fraction = Math.max(0, Math.min(1, width))
  if (fraction === 0) return '0px'
  if (fraction === 1) return '100%'
  return `calc(${fraction * 100}% - var(--alinea-field-gap) * ${1 - fraction})`
}
