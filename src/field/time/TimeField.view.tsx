import {TimeField as RacTimeField} from '#/components.js'
import {useField, useFieldError, useFieldOptions} from '#/dashboard/hooks.js'
import {TimeField} from '#/field/time.js'
import {parseTime} from '@internationalized/date'
import {useMemo} from 'react'

export interface TimeFieldViewProps {
  field: TimeField
}

export function TimeFieldView({field}: TimeFieldViewProps) {
  const [value = '', setValue] = useField(field)
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
      shared={options.shared}
      maxValue={options.maxValue ? parseTime(options.maxValue) : null}
      minValue={options.minValue ? parseTime(options.minValue) : null}
      onChange={next => setValue(next?.toString() || '')}
      value={parsedValue}
    />
  )
}
