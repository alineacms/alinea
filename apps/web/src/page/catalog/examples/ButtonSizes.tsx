'use client'

import {Button} from 'alinea/components'
import {IcRoundEdit} from 'alinea/dashboard/icons'

export function ButtonSizesExample() {
  return (
    <>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button
        size="icon"
        variant="outline"
        icon={IcRoundEdit}
        aria-label="Edit"
      />
    </>
  )
}
