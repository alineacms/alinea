import {DatePicker} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {DateField} from '#/field/date.js'
import {parseDate} from '@internationalized/date'
import {useMemo} from 'react'
import {I18nProvider} from 'react-aria-components'

export interface DateFieldViewProps {
  field: DateField
}

export function DateFieldView({field}: DateFieldViewProps) {
  const [value = '', setValue] = useField(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const parsedValue = useMemo(() => {
    if (!value) return null
    return parseDate(value)
  }, [value])

  return (
    <I18nProvider locale="en-GB">
      <DatePicker
        description={options.help}
        errorMessage={error}
        isRequired={options.required}
        isDisabled={options.readOnly}
        label={options.label}
        shared={options.shared}
        onChange={next => setValue(next?.toString() || '')}
        value={parsedValue}
      />
    </I18nProvider>
  )
}
