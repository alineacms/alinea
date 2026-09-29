import {useState} from 'react'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Checkbox>Accept terms</Checkbox>
      <Checkbox description="Receive an email when someone mentions you.">
        Notifications
      </Checkbox>
      <Checkbox defaultChecked>Checked by default</Checkbox>
      <Checkbox checked="indeterminate">Indeterminate</Checkbox>
    </div>
  )
}

export function Controlled() {
  const [checked, setChecked] = useState(false)
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Checkbox checked={checked} onCheckedChange={setChecked}>
        Subscribe
      </Checkbox>
      <p data-testid="state">{checked ? 'Subscribed' : 'Not subscribed'}</p>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Checkbox error="You must accept the terms">Invalid</Checkbox>
      <Checkbox disabled>Disabled</Checkbox>
      <Checkbox disabled defaultChecked>
        Disabled and checked
      </Checkbox>
      <Checkbox readOnly defaultChecked>
        Read-only and checked
      </Checkbox>
      <form
        onSubmit={event => event.preventDefault()}
        style={{display: 'flex', alignItems: 'center', gap: 8}}
      >
        <Checkbox required name="required">
          Required
        </Checkbox>
        <Button type="submit">Submit</Button>
      </form>
    </div>
  )
}

export default {
  title: 'Pure components / Checkbox'
}
