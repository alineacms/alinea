import {useState} from 'react'
import {NumberField} from './NumberField.js'

const column = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 320,
  padding: 24
} as const

export function Example() {
  const [value, setValue] = useState<number | null>(3)
  return (
    <div style={column}>
      <NumberField
        label="Cookies"
        min={0}
        max={10}
        value={value}
        onValueChange={setValue}
      />
      <output data-testid="cookies">{String(value)}</output>
      <NumberField label="Without steppers" steppers={false} />
      <NumberField
        label="Step"
        description="Moves in steps of 5."
        step={5}
        defaultValue={10}
      />
    </div>
  )
}

export function Formatted() {
  return (
    <div style={column}>
      <NumberField
        label="Amount"
        defaultValue={45}
        formatOptions={{style: 'currency', currency: 'EUR'}}
      />
      <NumberField
        label="Discount"
        defaultValue={0.25}
        step={0.01}
        formatOptions={{style: 'percent'}}
      />
    </div>
  )
}

export function States() {
  return (
    <div style={column}>
      <NumberField required label="Required" error="Field cannot be empty." />
      <NumberField disabled label="Disabled" defaultValue={1} />
      <NumberField readOnly label="Read-only" defaultValue={2} />
    </div>
  )
}

export default {
  title: 'Pure components / NumberField'
}
