import {useState} from 'react'
import {DatePicker} from './DatePicker.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
      <DatePicker label="Default" />
      <DatePicker
        label="With description"
        description="Select a date for the event"
      />
      <DatePicker
        label="Only September 2026"
        min="2026-09-01"
        max="2026-09-30"
      />
      <DatePicker required label="With error" error="Date is required" />
      <DatePicker label="Disabled" defaultValue="2026-09-23" disabled />
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>('2026-09-23')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <DatePicker label="Event date" value={value} onValueChange={setValue} />
      <output data-testid="value">{String(value)}</output>
    </div>
  )
}

export default {title: 'Pure components / DatePicker'}
