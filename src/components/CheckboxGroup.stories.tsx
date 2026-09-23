import {useState} from 'react'
import {Checkbox} from './Checkbox.js'
import {CheckboxGroup} from './CheckboxGroup.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <CheckboxGroup label="Favorite sports" defaultValue={['soccer']}>
        <Checkbox value="soccer">Soccer</Checkbox>
        <Checkbox value="baseball">Baseball</Checkbox>
        <Checkbox value="basketball">Basketball</Checkbox>
      </CheckboxGroup>
      <CheckboxGroup
        label="Horizontal"
        description="Items laid out in a row"
        orientation="horizontal"
      >
        <Checkbox value="a">Option A</Checkbox>
        <Checkbox value="b">Option B</Checkbox>
        <Checkbox value="c">Option C</Checkbox>
      </CheckboxGroup>
    </div>
  )
}

export function Controlled() {
  const [value, setValue] = useState<Array<string>>(['apple'])
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <CheckboxGroup label="Fruit" value={value} onValueChange={setValue}>
        <Checkbox value="apple">Apple</Checkbox>
        <Checkbox value="orange">Orange</Checkbox>
        <Checkbox value="grape">Grape</Checkbox>
      </CheckboxGroup>
      <p data-testid="state">{value.join(',')}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <CheckboxGroup label="Disabled" disabled defaultValue={['apple']}>
        <Checkbox value="apple">Apple</Checkbox>
        <Checkbox value="orange">Orange</Checkbox>
      </CheckboxGroup>
      <CheckboxGroup label="Invalid" required error="Pick at least one">
        <Checkbox value="apple">Apple</Checkbox>
        <Checkbox value="orange">Orange</Checkbox>
      </CheckboxGroup>
      <CheckboxGroup label="Shared" shared description="Shared between locales">
        <Checkbox value="apple">Apple</Checkbox>
      </CheckboxGroup>
    </div>
  )
}

export default {
  title: 'Pure components / CheckboxGroup'
}
