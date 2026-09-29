import {useState} from 'react'
import {ComboBox, ComboBoxItem} from './ComboBox.js'

const software = [
  {value: 'photoshop', label: 'Adobe Photoshop'},
  {value: 'xd', label: 'Adobe XD'},
  {value: 'figma', label: 'Figma'},
  {value: 'invision', label: 'InVision'},
  {value: 'sketch', label: 'Sketch'}
]

export function Example() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox
        label="Design software"
        placeholder="Search software"
        value={value}
        onValueChange={setValue}
        emptyMessage="No software found"
      >
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <p data-testid="value">Value: {value ?? 'none'}</p>
    </div>
  )
}

export function CustomValue() {
  const [inputValue, setInputValue] = useState('')
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox
        label="Tag"
        description="Type a new tag or pick an existing one"
        allowsCustomValue
        inputValue={inputValue}
        onInputValueChange={setInputValue}
      >
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <p data-testid="input">Input: {inputValue}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <ComboBox label="Default value" defaultValue="figma">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Disabled" disabled defaultValue="figma">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Disabled items">
        {software.map((item, i) => (
          <ComboBoxItem
            key={item.value}
            value={item.value}
            disabled={i % 2 === 1}
          >
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <ComboBox label="Invalid" required error="Please select an item.">
        {software.map(item => (
          <ComboBoxItem key={item.value} value={item.value}>
            {item.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
    </div>
  )
}

export default {
  title: 'Pure components / ComboBox'
}
