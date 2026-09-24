'use client'

import {Button} from 'alinea/components'
import {IcRoundCheck} from 'alinea/dashboard/icons'

export function ButtonExample() {
  return (
    <>
      <Button variant="outline">Cancel</Button>
      <Button color="primary" icon={IcRoundCheck}>
        Publish
      </Button>
    </>
  )
}
