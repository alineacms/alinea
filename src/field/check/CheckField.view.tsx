import {Checkbox, Label} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/store.js'
import {CheckField} from '#/field/check.js'

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
      isRequired={options.required}
      shared={options.shared}
    >
      <Checkbox
        isSelected={Boolean(value)}
        isDisabled={options.readOnly}
        onChange={setValue}
        label={options.description ?? options.label}
      />
    </Label>
  )
}
