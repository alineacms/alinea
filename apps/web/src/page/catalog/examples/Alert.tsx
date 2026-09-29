'use client'

import {Alert, AlertDescription, AlertTitle} from 'alinea/components'
import {IcRoundTranslate} from 'alinea/dashboard/icons'

export function AlertExample() {
  return (
    <Alert icon={IcRoundTranslate} style={{width: 300}}>
      <AlertTitle>Not translated yet</AlertTitle>
      <AlertDescription>
        This product page has no French version.
      </AlertDescription>
    </Alert>
  )
}
