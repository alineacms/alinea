import {TimeField as TimeInput} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {TimeField} from '#/field/time.js'

export interface TimeFieldViewProps {
  field: TimeField
}

export function TimeFieldView({field}: TimeFieldViewProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  return (
    <TimeInput
      description={options.help}
      error={error}
      hourCycle={24}
      disabled={options.readOnly}
      required={options.required}
      label={options.label}
      shared={options.shared}
      max={options.maxValue}
      min={options.minValue}
      // Stored times have always included seconds, keep writing `HH:mm:ss`
      onValueChange={next => setValue(next ? `${next}:00` : '')}
      value={value || null}
    />
  )
}
