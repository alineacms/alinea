'use client'

import {ColorSwatchPicker, ColorSwatchPickerItem} from 'alinea/components'

const colors = ['#e8e0d2', '#c9a27e', '#8a5a3b', '#5b6b4f', '#3e4a5c']

export function ColorSwatchPickerExample() {
  return (
    <ColorSwatchPicker aria-label="Fabric color" defaultValue="#8a5a3b">
      {colors.map(color => (
        <ColorSwatchPickerItem key={color} color={color} />
      ))}
    </ColorSwatchPicker>
  )
}
