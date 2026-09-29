'use client'

import {Button} from 'alinea/components'
import {IcRoundAdd} from 'alinea/dashboard/icons'

export function ButtonIconsExample() {
  return (
    <>
      <Button variant="outline" icon={IcRoundAdd}>
        Add entry
      </Button>
      <Button color="primary" loading>
        Publishing
      </Button>
    </>
  )
}
