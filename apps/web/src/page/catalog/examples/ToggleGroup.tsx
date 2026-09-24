'use client'

import {ToggleGroup, ToggleGroupItem} from 'alinea/components'
import {IcOutlineGridView, IcOutlineTableRows} from 'alinea/dashboard/icons'

export function ToggleGroupExample() {
  return (
    <ToggleGroup type="single" defaultValue="cards" aria-label="Layout">
      <ToggleGroupItem value="cards" icon={IcOutlineGridView}>
        Cards
      </ToggleGroupItem>
      <ToggleGroupItem value="table" icon={IcOutlineTableRows}>
        Table
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
