import {useState} from 'react'
import {Calendar, RangeCalendar} from './Calendar.js'
import type {DateRange} from './types.js'

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

export function Example() {
  const [value, setValue] = useState<string | null>('2026-09-23')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Calendar
        aria-label="Event date"
        value={value}
        onValueChange={setValue}
      />
      <output data-testid="value">{value}</output>
    </div>
  )
}

export function Constraints() {
  return (
    <Calendar
      aria-label="Weekday in September"
      defaultValue="2026-09-15"
      min="2026-09-10"
      max="2026-09-25"
      isDateUnavailable={isWeekend}
    />
  )
}

export function Disabled() {
  return <Calendar aria-label="Disabled" defaultValue="2026-09-23" disabled />
}

export function Range() {
  const [value, setValue] = useState<DateRange | null>({
    start: '2026-09-07',
    end: '2026-09-11'
  })
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <RangeCalendar
        aria-label="Trip dates"
        value={value}
        onValueChange={setValue}
      />
      <output data-testid="value">
        {value ? `${value.start} – ${value.end}` : ''}
      </output>
    </div>
  )
}

export default {title: 'Pure components / Calendar'}
