import {NumberField as RacNumberField} from '@alinea/components'
import {NumberField} from 'alinea/field/number'
import {useFieldError, useFieldOptions, useFieldValue} from '../../store.js'

export interface NumberFieldViewProps {
  field: NumberField
}

export function NumberFieldView({field}: NumberFieldViewProps) {
  const [value, setValue] = useFieldValue(field)
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
      value={typeof value === 'number' ? value : undefined}
    />
  )
}
