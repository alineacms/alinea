import {DatePicker} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {DateField} from '#/field/date.js'

export interface DateFieldViewProps {
  field: DateField
}

export function DateFieldView({field}: DateFieldViewProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  // Dates are always shown as day/month/year in the dashboard
  return (
    <DatePicker
      locale="en-GB"
      description={options.help}
      error={error}
      required={options.required}
      disabled={options.readOnly}
      label={options.label}
      shared={options.shared}
      onValueChange={next => setValue(next || '')}
      value={value || null}
    />
  )
}
