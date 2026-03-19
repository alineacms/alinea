import {TimeField as RacTimeField} from '@alinea/components'
import {parseTime} from '@internationalized/date'
import {TimeField} from 'alinea/field/time'
import {useMemo} from 'react'
import {useFieldError, useFieldOptions, useFieldValue} from '../../store.js'

export interface TimeFieldViewProps {
  field: TimeField
}

export function TimeFieldView({field}: TimeFieldViewProps) {
  const [value = '', setValue] = useFieldValue(field)
  const options = useFieldOptions(field)
  const error = useFieldError(field)
  const parsedValue = useMemo(() => {
    if (!value) return null
    return parseTime(value)
  }, [value])
  return (
    <RacTimeField
      description={options.help}
      errorMessage={error}
      granularity={options.step && options.step < 60 ? 'second' : 'minute'}
      hourCycle={24}
      isDisabled={options.readOnly}
      isRequired={options.required}
      label={options.label}
      maxValue={options.maxValue ? parseTime(options.maxValue) : null}
      minValue={options.minValue ? parseTime(options.minValue) : null}
      onChange={next => setValue(next?.toString() || '')}
      value={parsedValue}
    />
  )
}
