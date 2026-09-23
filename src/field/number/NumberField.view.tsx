import {NumberField as NumberFieldInput} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {NumberField} from '#/field/number.js'

export interface NumberFieldViewProps {
  field: NumberField
}

export function NumberFieldView({field}: NumberFieldViewProps) {
  const [value, setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <NumberFieldInput
      description={options.help}
      error={error}
      disabled={options.readOnly}
      required={options.required}
      aria-label={options.inline ? options.label : undefined}
      label={options.inline ? undefined : options.label}
      placeholder={
        options.placeholder ?? (options.inline ? options.label : undefined)
      }
      shared={options.shared}
      max={options.maxValue}
      min={options.minValue}
      onValueChange={setValue}
      step={options.step || 1}
      value={typeof value === 'number' ? value : null}
    />
  )
}
