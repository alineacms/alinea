import {Checkbox, Label, SharedLabelBadge} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/store.js'
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
    <Label
      label={options.description ? options.label : undefined}
      description={options.help}
      errorMessage={error}
      isRequired={options.description ? options.required : undefined}
      shared={options.description ? options.shared : undefined}
    >
      <div className={styles.checkline()}>
        <Checkbox
          isSelected={Boolean(value)}
          isDisabled={options.readOnly}
          onChange={setValue}
          label={options.description ?? options.label}
        />
        {!options.description && (
          <>
            {options.required && (
              <span className={styles.checkline.required()}> *</span>
            )}
            {options.shared && <SharedLabelBadge />}
          </>
        )}
      </div>
    </Label>
  )
}
