import {useState} from 'react'
import {
  IcBaselineContentCopy,
  IcRoundArchive,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundMoreVert
} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from './DropdownMenu.js'

export function Example() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant="ghost"
        size="icon"
        icon={IcRoundMoreVert}
        aria-label="More actions"
      />
      <DropdownMenuContent side="bottom" align="start" aria-label="Actions">
        <DropdownMenuItem icon={IcRoundEdit}>
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

export function AsChild() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Custom trigger</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Actions">
        <DropdownMenuItem>First</DropdownMenuItem>
        <DropdownMenuItem>Second</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Selection() {
  const [align, setAlign] = useState('left')
  const [bold, setBold] = useState(true)
  const [italic, setItalic] = useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="outline">Format</DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Format">
        <DropdownMenuGroup aria-label="Style">
          <DropdownMenuLabel>Style</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={bold} onCheckedChange={setBold}>
            Bold
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={italic}
            onCheckedChange={setItalic}
          >
            Italic
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          aria-label="Align"
          value={align}
          onValueChange={setAlign}
        >
          <DropdownMenuLabel>Align</DropdownMenuLabel>
          <DropdownMenuRadioItem value="left">Left</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="center">Center</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Submenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="outline">Share</DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Share">
        <DropdownMenuItem>Copy link</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Send to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent aria-label="Send to">
            <DropdownMenuItem>Email</DropdownMenuItem>
            <DropdownMenuItem>Slack</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default {
  title: 'Pure components / DropdownMenu'
}
