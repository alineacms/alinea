import {Checkbox, Label} from '#/components.js'
import {CheckField} from '#/field/check.js'
import {useFieldError, useFieldOptions, useFieldValue} from '../../../store.js'

export interface CheckFieldViewProps {
  field: CheckField
}

export function CheckFieldView({field}: CheckFieldViewProps) {
  const [value, setValue] = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <Label
      label={options.description ? options.label : undefined}
      description={options.help}
      errorMessage={error}
      isRequired={options.required}
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
