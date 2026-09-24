'use client'

import {DateRangePicker} from 'alinea/components'

export function DateRangePickerExample() {
  return (
    <DateRangePicker
      label="Sale period"
      defaultValue={{start: '2026-11-27', end: '2026-11-30'}}
      style={{width: 300}}
    />
  )
}
