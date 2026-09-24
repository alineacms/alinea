'use client'

import {Switch} from 'alinea/components'

export function SwitchStatesExample() {
  return (
    <div style={{display: 'grid', gap: 16, width: 280}}>
      <Switch>Show prices incl. VAT</Switch>
      <Switch defaultChecked>Free shipping</Switch>
      <Switch disabled>Gift cards</Switch>
      <Switch defaultChecked readOnly>
        Maintenance mode
      </Switch>
    </div>
  )
}
