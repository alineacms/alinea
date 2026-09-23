import {useState} from 'react'
import {ColorSwatch} from './ColorSwatch.js'
import {ColorSwatchPicker, ColorSwatchPickerItem} from './ColorSwatchPicker.js'

const colors = [
  '#aa0000',
  '#ff8800',
  '#008800',
  '#0088ff',
  '#008888',
  '#000088'
]

export function Example() {
  return (
    <div style={{padding: 24}}>
      <ColorSwatchPicker aria-label="Color" defaultValue="#ff8800">
        {colors.map(color => (
          <ColorSwatchPickerItem key={color} color={color} />
        ))}
      </ColorSwatchPicker>
    </div>
  )
}

export function Controlled() {
  const [color, setColor] = useState('#0088ff')
  return (
    <div style={{padding: 24, display: 'grid', gap: 12}}>
      <ColorSwatchPicker
        aria-label="Color"
        value={color}
        onValueChange={setColor}
      >
        {colors.map(color => (
          <ColorSwatchPickerItem key={color} color={color} />
        ))}
      </ColorSwatchPicker>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <ColorSwatch color={color} />
        <output data-testid="selected-color">{color}</output>
      </div>
    </div>
  )
}

export function Stack() {
  return (
    <div style={{padding: 24}}>
      <ColorSwatchPicker aria-label="Color" layout="stack">
        {colors.slice(0, 3).map(color => (
          <ColorSwatchPickerItem key={color} color={color} />
        ))}
        <ColorSwatchPickerItem color="#888888" disabled />
      </ColorSwatchPicker>
    </div>
  )
}

export default {
  title: 'Pure components / ColorSwatchPicker'
}
