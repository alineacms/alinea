import {DatePicker} from '@alinea/components'
import {parseDate} from '@internationalized/date'
import {DateField} from 'alinea/field/date'
import {useMemo} from 'react'
import {useFieldError, useFieldOptions, useFieldValue} from '../../store.js'

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
