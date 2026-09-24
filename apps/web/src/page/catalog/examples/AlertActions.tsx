'use client'

import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Button
} from 'alinea/components'
import {IcRoundHistory} from 'alinea/dashboard/icons'

export function AlertActionsExample() {
  return (
    <Alert icon={IcRoundHistory} style={{width: 420}}>
      <AlertTitle>A newer draft exists</AlertTitle>
      <AlertDescription>
        Maya Janssens saved a draft of “Oak dining chair” 5 minutes ago.
      </AlertDescription>
      <AlertActions>
        <Button size="sm" variant="outline">
          Discard
        </Button>
        <Button size="sm" color="primary">
          Open draft
        </Button>
      </AlertActions>
    </Alert>
  )
}
