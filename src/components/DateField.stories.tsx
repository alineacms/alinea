import {useState} from 'react'
import {IcRoundDateRange} from '#/dashboard/icons.js'
import {DateField} from './DateField.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
      <DateField label="Default" />
      <DateField
        label="With description"
        description="The day the event starts"
        icon={IcRoundDateRange}
        shared
      />
      <DateField required label="With error" error="Date is required" />
      <DateField label="Disabled" defaultValue="2026-09-23" disabled />
      <DateField label="Read only" defaultValue="2026-09-23" readOnly />
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>('2026-09-23')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <DateField
        label="Start date"
        value={value}
        onValueChange={setValue}
        min="2026-01-01"
        max="2026-12-31"
      />
      <output data-testid="value">{String(value)}</output>
    </div>
  )
}

export default {title: 'Pure components / DateField'}
