import {useState} from 'react'
import {DateRangePicker} from './DateRangePicker.js'
import type {DateRange} from './types.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
      <DateRangePicker label="Default" />
      <DateRangePicker
        label="With description"
        description="Select a date range for your event"
      />
      <DateRangePicker
        label="Only September 2026"
        min="2026-09-01"
        max="2026-09-30"
      />
      <DateRangePicker
        label="With error"
        required
        error="Date range is required"
      />
      <DateRangePicker
        label="Disabled"
        defaultValue={{start: '2026-09-07', end: '2026-09-11'}}
        disabled
      />
    </div>
  )
}

function days(range: DateRange) {
  const start = Date.parse(`${range.start}T00:00:00Z`)
  const end = Date.parse(`${range.end}T00:00:00Z`)
  return (end - start) / 86_400_000
}

export function Controlled() {
  const [range, setRange] = useState<DateRange | null>({
    start: '2026-09-07',
    end: '2026-09-11'
  })
  const tooLong = range && days(range) > 7
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <DateRangePicker
        label="Booking (1 week max)"
        value={range}
        onValueChange={setRange}
        error={tooLong ? 'Maximum booking duration is 1 week.' : undefined}
      />
      <output data-testid="value">
        {range ? `${range.start} – ${range.end}` : 'null'}
      </output>
    </div>
  )
}

export default {title: 'Pure components / DateRangePicker'}
