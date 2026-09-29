'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from 'alinea/components'
import {
  IcBaselineContentCopy,
  IcRoundArchive,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundMoreHoriz
} from 'alinea/dashboard/icons'

export function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant="outline"
        size="icon"
        icon={IcRoundMoreHoriz}
        aria-label="Entry actions"
      />
      <DropdownMenuContent align="start" aria-label="Entry actions">
        <DropdownMenuItem icon={IcRoundEdit} onSelect={() => {}}>
          Rename
          <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem icon={IcBaselineContentCopy}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem icon={IcRoundArchive} disabled>
          Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={IcRoundDelete} variant="destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
