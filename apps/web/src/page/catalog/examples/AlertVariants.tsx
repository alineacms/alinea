'use client'

import {Alert, AlertDescription, AlertTitle} from 'alinea/components'
import {
  IcBaselineErrorOutline,
  IcRoundInfo,
  IcRoundWarning
} from 'alinea/dashboard/icons'

export function AlertVariantsExample() {
  return (
    <div style={{display: 'grid', gap: 12, width: 420}}>
      <Alert icon={IcRoundInfo}>
        <AlertTitle>Scheduled for Monday</AlertTitle>
        <AlertDescription>
          The autumn collection goes live at 9:00.
        </AlertDescription>
      </Alert>
      <Alert variant="warning" icon={IcRoundWarning}>
        <AlertTitle>Unpublished changes</AlertTitle>
        <AlertDescription>Tom Verbeke is editing this page.</AlertDescription>
      </Alert>
      <Alert variant="destructive" icon={IcBaselineErrorOutline}>
        <AlertTitle>Could not publish</AlertTitle>
        <AlertDescription>
          The path /linen-shirt is already in use.
        </AlertDescription>
      </Alert>
    </div>
  )
}
