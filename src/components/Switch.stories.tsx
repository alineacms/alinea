import {useState} from 'react'
import {Switch} from './Switch.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Switch>Wi-Fi</Switch>
      <Switch defaultChecked>Bluetooth</Switch>
      <Switch disabled>Disabled</Switch>
      <Switch disabled defaultChecked>
        Disabled and checked
      </Switch>
      <Switch readOnly defaultChecked>
        Read-only
      </Switch>
    </div>
  )
}

export function Controlled() {
  const [checked, setChecked] = useState(false)
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Switch checked={checked} onCheckedChange={setChecked}>
        Airplane mode
      </Switch>
      <p data-testid="state">{checked ? 'On' : 'Off'}</p>
    </div>
  )
}

export default {
  title: 'Pure components / Switch'
}
