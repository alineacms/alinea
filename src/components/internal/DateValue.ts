import {
  type CalendarDate,
  parseDate,
  parseTime,
  type Time
} from '@internationalized/date'
import type {DateRange} from '../types.js'

// Our components take ISO strings, react-aria works with
// @internationalized/date objects. An undefined value keeps a react-aria
// component uncontrolled, anything that does not parse clears it.

export function toCalendarDate(
  value: string | null | undefined
): CalendarDate | null | undefined {
  if (value === undefined) return undefined
  if (!value) return null
  try {
    return parseDate(value)
  } catch {
    return null
  }
}

export function toCalendarRange(
  value: DateRange | null | undefined
): {start: CalendarDate; end: CalendarDate} | null | undefined {
  if (value === undefined) return undefined
  const start = value && toCalendarDate(value.start)
  const end = value && toCalendarDate(value.end)
  if (!start || !end) return null
  return {start, end}
}

export function toTime(
  value: string | null | undefined
): Time | null | undefined {
  if (value === undefined) return undefined
  if (!value) return null
  try {
    return parseTime(value)
  } catch {
    return null
  }
}

interface TimeParts {
  hour: number
  minute: number
  second: number
}

/** Formats a time as `HH:mm`, or `HH:mm:ss` when seconds are shown */
export function formatTime(time: TimeParts, granularity: 'minute' | 'second') {
  const pad = (n: number) => String(n).padStart(2, '0')
  const hhmm = `${pad(time.hour)}:${pad(time.minute)}`
  return granularity === 'second' ? `${hhmm}:${pad(time.second)}` : hhmm
}
