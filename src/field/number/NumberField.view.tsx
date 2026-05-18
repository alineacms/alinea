import {NumberField as RacNumberField} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/store.js'
import {NumberField} from '#/field/number.js'

export interface NumberFieldViewProps {
  field: NumberField
}

export function NumberFieldView({field}: NumberFieldViewProps) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <RacNumberField
      description={options.help}
      errorMessage={error}
      isDisabled={options.readOnly}
      isRequired={options.required}
      label={options.label}
      maxValue={options.maxValue}
      minValue={options.minValue}
      onChange={next => setValue(Number.isNaN(next) ? null : next)}
      step={options.step || 1}
      value={typeof value === 'number' ? value : 0}
    />
  )
}
