'use client'

import {DatePicker} from 'alinea/components'

export function DatePickerExample() {
  return (
    <DatePicker
      label="Launch date"
      defaultValue="2026-10-01"
      min="2026-09-24"
      style={{width: 240}}
    />
  )
}
