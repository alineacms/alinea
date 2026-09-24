'use client'

import {
  DialogClose,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text
} from 'alinea/components'
import {IcRoundVisibility} from 'alinea/dashboard/icons'

export function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger variant="outline" icon={IcRoundVisibility}>
        Visibility
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" aria-label="Visibility">
        <div style={{display: 'grid', gap: 10, justifyItems: 'start'}}>
          <Text size="sm" color="muted">
            Choose where this entry is shown.
          </Text>
          <Switch defaultChecked>In navigation</Switch>
          <Switch>In search results</Switch>
          <DialogClose size="sm">Done</DialogClose>
        </div>
      </PopoverContent>
    </Popover>
  )
}
