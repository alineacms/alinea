import {useState} from 'react'
import {RadioGroup, RadioGroupItem} from './RadioGroup.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <RadioGroup label="Favorite sport" defaultValue="soccer">
        <RadioGroupItem value="soccer">Soccer</RadioGroupItem>
        <RadioGroupItem value="baseball">Baseball</RadioGroupItem>
        <RadioGroupItem value="basketball" disabled>
          Basketball
        </RadioGroupItem>
      </RadioGroup>
      <RadioGroup label="Plan" description="Choose a plan">
        <RadioGroupItem value="free" description="Up to 3 projects">
          Free
        </RadioGroupItem>
        <RadioGroupItem value="pro" description="Unlimited projects">
          Pro
        </RadioGroupItem>
      </RadioGroup>
      <RadioGroup label="Horizontal" orientation="horizontal">
        <RadioGroupItem value="left">Left</RadioGroupItem>
        <RadioGroupItem value="center">Center</RadioGroupItem>
        <RadioGroupItem value="right">Right</RadioGroupItem>
      </RadioGroup>
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState('apple')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <RadioGroup label="Juice" value={value} onValueChange={setValue}>
        <RadioGroupItem value="apple">Apple</RadioGroupItem>
        <RadioGroupItem value="orange">Orange</RadioGroupItem>
        <RadioGroupItem value="grape">Grape</RadioGroupItem>
      </RadioGroup>
      <p data-testid="state">{value}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <RadioGroup label="Disabled" disabled defaultValue="apple">
        <RadioGroupItem value="apple">Apple</RadioGroupItem>
        <RadioGroupItem value="orange">Orange</RadioGroupItem>
      </RadioGroup>
      <RadioGroup label="Read-only" readOnly defaultValue="apple">
        <RadioGroupItem value="apple">Apple</RadioGroupItem>
        <RadioGroupItem value="orange">Orange</RadioGroupItem>
      </RadioGroup>
      <RadioGroup label="Invalid" required error="Pick one">
        <RadioGroupItem value="apple">Apple</RadioGroupItem>
        <RadioGroupItem value="orange">Orange</RadioGroupItem>
      </RadioGroup>
    </div>
  )
}

export default {
  title: 'Pure components / RadioGroup'
}
