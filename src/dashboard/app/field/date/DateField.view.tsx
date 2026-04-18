import {DatePicker} from '#/components.js'
import {
  useFieldError,
  useFieldOptions,
  useFieldValue
} from '#/dashboard/store/hooks.js'
import {DateField} from '#/field/date.js'
import {parseDate} from '@internationalized/date'
import {useMemo} from 'react'

export interface DateFieldViewProps {
  field: DateField
}

export function DateFieldView({field}: DateFieldViewProps) {
  const [value = '', setValue] = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const parsedValue = useMemo(() => {
    if (!value) return null
    return parseDate(value)
  }, [value])

  return (
    <DatePicker
      description={options.help}
      errorMessage={error}
      isRequired={options.required}
      isDisabled={options.readOnly}
      label={options.label}
      onChange={next => setValue(next?.toString() || '')}
      value={parsedValue}
    />
  )
}
