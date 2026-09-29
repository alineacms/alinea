import {useState} from 'react'
import {IcRoundFormatBold, IcRoundFormatItalic} from '#/dashboard/icons.js'
import {Toggle} from './Toggle.js'

export function Example() {
  return (
    <div style={{display: 'flex', gap: 8}}>
      <Toggle aria-label="Bold" icon={IcRoundFormatBold} />
      <Toggle variant="outline" icon={IcRoundFormatItalic} defaultPressed>
        Italic
      </Toggle>
      <Toggle size="sm">Small</Toggle>
      <Toggle size="lg">Large</Toggle>
      <Toggle disabled>Disabled</Toggle>
    </div>
  )
}

export function Controlled() {
  const [pressed, setPressed] = useState(false)
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <Toggle
        variant="outline"
        pressed={pressed}
        onPressedChange={setPressed}
        icon={IcRoundFormatBold}
      >
        Bold
      </Toggle>
      <span>{pressed ? 'On' : 'Off'}</span>
    </div>
  )
}

export default {
  title: 'Pure components / Toggle'
}
