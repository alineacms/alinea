import {Checkbox, Field, FieldSharedBadge} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {CheckField} from '#/field/check.js'
import styler from '@alinea/styler'
import css from './CheckField.module.css'

const styles = styler(css)

export interface CheckFieldViewProps {
  field: CheckField
}

export function CheckFieldView({field}: CheckFieldViewProps) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <Field
      label={options.description ? options.label : undefined}
      description={options.help}
      error={error}
      required={options.description ? options.required : undefined}
      shared={options.description ? options.shared : undefined}
    >
      <Checkbox
        autoFocus={options.autoFocus}
        checked={Boolean(value)}
        disabled={options.readOnly}
        onCheckedChange={setValue}
      >
        {options.description ?? options.label}
        {/* Inside the label so they flow after its text when it wraps */}
        {!options.description && options.required && (
          <span className={styles.CheckField.required()}>{' *'}</span>
        )}
        {!options.description && options.shared && (
          <FieldSharedBadge className={styles.CheckField.shared()} />
        )}
      </Checkbox>
    </Field>
  )
}
