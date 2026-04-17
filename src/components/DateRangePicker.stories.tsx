import {endOfYear, getLocalTimeZone, today} from '@internationalized/date'
import {useState} from 'react'
import {I18nProvider} from 'react-aria-components'
import type {DateRange} from 'react-aria-components'
import {DateRangePicker} from '../components/DateRangePicker.tsx'
import {Stack} from '../stories/Stack.tsx'

export const Basic = () => {
  return (
    <I18nProvider locale="en-UK">
      <Stack gap={32}>
        <DateRangePicker label="Default" />
        <DateRangePicker
          label="With Description"
          description="Select a date range for your event"
        />
        <DateRangePicker
          label="minValue (today)"
          minValue={today(getLocalTimeZone())}
        />
        <DateRangePicker
          label="maxValue (endOfYear)"
          maxValue={endOfYear(today(getLocalTimeZone()))}
        />
        <DateRangePicker
          label="With Error"
          isRequired
          isInvalid
          errorMessage="Date range is required"
        />
        <DateRangePicker label="Disabled" isDisabled />
      </Stack>
    </I18nProvider>
  )
}

export const CustomValidation = () => {
  const [range, setRange] = useState<DateRange | null>({
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({weeks: 1})
  })
  const isInvalid = range?.end && range.end.compare(range.start) > 7
  const errorMessage =
    range?.end && range.end.compare(range.start) > 7
      ? 'Maximum booking duration is 1 week.'
      : undefined

  return (
    <DateRangePicker
      label="Custom validation (1 week max)"
      value={range}
      onChange={setRange}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
    />
  )
}

export default {title: 'Components / DateRangePicker'}
