import {DatePicker} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {DateField} from '#/field/date.js'
import {I18nProvider} from 'react-aria-components'

export interface DateFieldViewProps {
  field: DateField
}

export function DateFieldView({field}: DateFieldViewProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  // The public components take their locale from react-aria's I18nProvider,
  // dates are always shown as day/month/year in the dashboard
  return (
    <I18nProvider locale="en-GB">
      <DatePicker
        description={options.help}
        error={error}
        required={options.required}
        disabled={options.readOnly}
        label={options.label}
        shared={options.shared}
        onValueChange={next => setValue(next || '')}
        value={value || null}
      />
    </I18nProvider>
  )
}
