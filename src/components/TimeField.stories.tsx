import {useState} from 'react'
import {TimeField} from './TimeField.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <TimeField label="Event time" />
      <TimeField required label="With error" error="Time is required" />
      <TimeField label="24 hour clock" hourCycle={24} />
      <TimeField
        label="With description"
        hourCycle={24}
        description="Opening hours start"
      />
      <TimeField label="Disabled" defaultValue="09:30" disabled />
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>('14:30')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <TimeField
        label="Start time"
        hourCycle={24}
        value={value}
        onValueChange={setValue}
      />
      <TimeField
        label="With seconds"
        hourCycle={24}
        granularity="second"
        defaultValue="08:15:30"
      />
      <output data-testid="value">{String(value)}</output>
    </div>
  )
}

export default {title: 'Pure components / TimeField'}
