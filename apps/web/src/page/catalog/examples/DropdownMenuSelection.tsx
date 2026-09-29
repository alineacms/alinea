'use client'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'alinea/components'
import {IcRoundFilterList} from 'alinea/dashboard/icons'
import {useState} from 'react'

export function DropdownMenuSelectionExample() {
  const [drafts, setDrafts] = useState(true)
  const [archived, setArchived] = useState(false)
  const [sort, setSort] = useState('updated')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="outline" icon={IcRoundFilterList}>
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="View options">
        <DropdownMenuGroup aria-label="Show">
          <DropdownMenuLabel>Show</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={drafts}
            onCheckedChange={setDrafts}
          >
            Drafts
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={archived}
            onCheckedChange={setArchived}
          >
            Archived entries
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={setSort}
          aria-label="Sort by"
        >
          <DropdownMenuRadioItem value="updated">
            Last updated
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
