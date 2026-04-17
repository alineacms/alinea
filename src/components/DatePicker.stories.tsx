import {endOfYear, getLocalTimeZone, today} from '@internationalized/date'
import {useState} from 'react'
import {I18nProvider} from 'react-aria-components'
import {DatePicker} from './DatePicker.tsx'
import {Stack} from '../stories/Stack.tsx'

export const Example = () => {
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(true)
  }

  return (
    <I18nProvider locale="en-UK">
      <Stack gap={32}>
        <DatePicker label="Default" />
        <DatePicker
          label="With Description"
          description="Select a date for the event"
        />
        <DatePicker
          label="minValue (today)"
          minValue={today(getLocalTimeZone())}
        />
        <DatePicker
          label="maxValue (endOfYear)"
          maxValue={endOfYear(today(getLocalTimeZone()))}
        />
        <DatePicker
          isRequired
          isInvalid
          label="With Error"
          errorMessage="Date is required"
        />
        <DatePicker label="Disabled" isDisabled />
      </Stack>
    </I18nProvider>
  )
}

export default {title: 'Components / DatePicker'}