'use client'

import {Tooltip, TooltipContent, TooltipTrigger} from 'alinea/components'

const sides = ['top', 'right', 'bottom', 'left'] as const

export function TooltipSidesExample() {
  return (
    <>
      {sides.map(side => (
        <Tooltip key={side} delayDuration={0}>
          <TooltipTrigger variant="outline">{side}</TooltipTrigger>
          <TooltipContent side={side}>Shown on the {side}</TooltipContent>
        </Tooltip>
      ))}
    </>
  )
}
