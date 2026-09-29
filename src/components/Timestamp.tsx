import styler from '@alinea/styler'
import {useSyncExternalStore} from 'react'
import {useLocale} from 'react-aria'
import css from './Timestamp.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export type TimestampFormat = 'relative' | 'time' | 'date' | 'datetime'

export interface TimestampProps extends StyleProps, AriaProps, DataProps {
  /** A Date, milliseconds since the epoch or an ISO string */
  date: string | number | Date
  /**
   * `relative` shows eg. "5 min. ago" for the last week and the date after,
   * defaults to `datetime`
   */
  format?: TimestampFormat
  /** Formats in this locale instead of the surrounding one */
  locale?: string
  /** Tooltip text, defaults to the full date and time for shorter formats */
  title?: string
}

/** A date or time formatted for the reader's locale, rendered as `<time>` */
export function Timestamp({
  date,
  format = 'datetime',
  locale,
  title,
  className,
  ...props
}: TimestampProps) {
  const surrounding = useLocale().locale
  const lang = locale ?? surrounding
  const now = useNow(format === 'relative')
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return null
  // A date without a time is midnight UTC. Server rendering and hydration
  // format in UTC as well, the client renders its own time zone afterwards.
  const dateOnly = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const timeZone = dateOnly || now === undefined ? 'UTC' : undefined
  const full = formatter(lang, 'datetime', timeZone).format(value)
  return (
    <time
      data-slot="timestamp"
      {...props}
      dateTime={value.toISOString()}
      title={title ?? (format === 'datetime' ? undefined : full)}
      data-format={format}
      className={styles.Timestamp(styler.merge({className}))}
    >
      {format === 'datetime'
        ? full
        : format !== 'relative'
          ? formatter(lang, format, timeZone).format(value)
          : now === undefined
            ? formatter(lang, 'date', timeZone).format(value)
            : formatRelative(lang, value, now, timeZone)}
    </time>
  )
}

const options: Record<
  'time' | 'date' | 'datetime' | 'day',
  Intl.DateTimeFormatOptions
> = {
  time: {hour: '2-digit', minute: '2-digit'},
  date: {dateStyle: 'medium'},
  datetime: {dateStyle: 'medium', timeStyle: 'short'},
  day: {day: 'numeric', month: 'short'}
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(
  locale: string,
  style: keyof typeof options,
  timeZone?: string
) {
  const key = `${locale}|${style}|${timeZone}`
  let result = formatters.get(key)
  if (!result) {
    result = new Intl.DateTimeFormat(locale, {...options[style], timeZone})
    formatters.set(key, result)
  }
  return result
}

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()

function relativeFormatter(locale: string) {
  let result = relativeFormatters.get(locale)
  if (!result) {
    result = new Intl.RelativeTimeFormat(locale, {
      numeric: 'auto',
      style: 'narrow'
    })
    relativeFormatters.set(locale, result)
  }
  return result
}

function formatRelative(
  locale: string,
  date: Date,
  now: number,
  timeZone?: string
) {
  const relative = relativeFormatter(locale)
  const seconds = Math.round((date.getTime() - now) / 1000)
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return relative.format(days, 'day')
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return formatter(locale, sameYear ? 'day' : 'date', timeZone).format(date)
}

// Relative timestamps share a single clock that ticks while any is mounted
const tickInterval = 30_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  timer ??= setInterval(() => {
    for (const notify of listeners) notify()
  }, tickInterval)
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    clearInterval(timer)
    timer = undefined
  }
}

function subscribeNever() {
  return () => {}
}

/** Changes every tick, so subscribers render again */
function getTick() {
  return Math.floor(Date.now() / tickInterval)
}

function getStatic() {
  return 0
}

function getHydrating() {
  return undefined
}

/**
 * The current time, which updates every tick while `live`. It is undefined
 * while server rendering and hydrating, which must render the same markup.
 */
function useNow(live: boolean) {
  const tick = useSyncExternalStore(
    live ? subscribe : subscribeNever,
    live ? getTick : getStatic,
    getHydrating
  )
  return tick === undefined ? undefined : Date.now()
}
