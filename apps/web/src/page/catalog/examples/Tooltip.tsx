'use client'

import {Tooltip, TooltipContent, TooltipTrigger} from 'alinea/components'
import {IcRoundOpenInNew} from 'alinea/dashboard/icons'

export function TooltipExample() {
  return (
    <Tooltip>
      <TooltipTrigger
        variant="outline"
        size="icon"
        icon={IcRoundOpenInNew}
        aria-label="Open preview"
      />
      <TooltipContent>Open preview in a new tab</TooltipContent>
    </Tooltip>
  )
}
