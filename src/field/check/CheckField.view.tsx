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
      <div className={styles.checkline()}>
        <Checkbox
          autoFocus={options.autoFocus}
          checked={Boolean(value)}
          disabled={options.readOnly}
          onCheckedChange={setValue}
        >
          {options.description ?? options.label}
        </Checkbox>
        {!options.description && (
          <>
            {options.required && (
              <span className={styles.checkline.required()}> *</span>
            )}
            {options.shared && <FieldSharedBadge />}
          </>
        )}
      </div>
    </Field>
  )
}
