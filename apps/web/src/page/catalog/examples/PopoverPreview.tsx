'use client'

import {Button, Switch, Text} from 'alinea/components'
import {IcRoundVisibility} from 'alinea/dashboard/icons'
import type {CSSProperties} from 'react'

// An open popover would take focus, the catalog thumbnail shows its content
// in a frame styled like the popover
const panel: CSSProperties = {
  display: 'grid',
  gap: 10,
  width: 230,
  padding: 12,
  border: '1px solid var(--alinea-border)',
  borderRadius: 'var(--alinea-radius)',
  background: 'var(--alinea-input)',
  boxShadow: 'var(--alinea-shadow-tooltip)'
}

export function PopoverPreviewExample() {
  return (
    <div style={{display: 'grid', gap: 6, justifyItems: 'start'}}>
      <Button variant="outline" icon={IcRoundVisibility}>
        Visibility
      </Button>
      <div style={panel}>
        <Text size="sm" color="muted">
          Choose where this entry is shown.
        </Text>
        <Switch defaultChecked>In navigation</Switch>
        <Switch>In search results</Switch>
      </div>
    </div>
  )
}
