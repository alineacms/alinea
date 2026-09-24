'use client'

import {Toggle} from 'alinea/components'
import {IcRoundVisibility} from 'alinea/dashboard/icons'

export function ToggleExample() {
  return (
    <>
      <Toggle defaultPressed icon={IcRoundVisibility}>
        Preview
      </Toggle>
      <Toggle variant="outline">Show drafts</Toggle>
    </>
  )
}
