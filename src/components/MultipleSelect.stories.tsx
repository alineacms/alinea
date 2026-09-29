import {useState} from 'react'
import {MultipleSelect, MultipleSelectItem} from './MultipleSelect.js'

const fruits = [
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Honeydew',
  'Kiwi',
  'Lemon',
  'Mango',
  'Nectarine',
  'Orange',
  'Papaya',
  'Quince',
  'Raspberry',
  'Strawberry',
  'Tangerine',
  'Watermelon'
]

function fruitItems() {
  return fruits.map(fruit => (
    <MultipleSelectItem key={fruit} value={fruit.toLowerCase()}>
      {fruit}
    </MultipleSelectItem>
  ))
}

export function Example() {
  const [value, setValue] = useState<Array<string>>([])
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <MultipleSelect
        label="Fruits"
        placeholder="Select fruits"
        value={value}
        onValueChange={setValue}
      >
        {fruitItems()}
      </MultipleSelect>
      <p data-testid="value">Value: {value.join(', ') || 'none'}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <MultipleSelect
        label="Default value"
        defaultValue={['apple', 'banana']}
        emptyMessage="No fruit found"
      >
        {fruitItems()}
      </MultipleSelect>
      <MultipleSelect
        label="Disabled"
        description="The selection cannot be changed"
        disabled
        defaultValue={['apple', 'banana']}
      >
        {fruitItems()}
      </MultipleSelect>
      <MultipleSelect
        label="Invalid"
        required
        error="Select at least one fruit"
      >
        {fruitItems()}
      </MultipleSelect>
    </div>
  )
}

export default {
  title: 'Pure components / MultipleSelect'
}
