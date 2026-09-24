'use client'

import {
  Select,
  SelectGroup,
  SelectItem,
  SelectSeparator
} from 'alinea/components'
import {
  IcRoundDescription,
  IcRoundFeed,
  IcRoundImage
} from 'alinea/dashboard/icons'

export function SelectGroupsExample() {
  return (
    <Select label="Entry type" defaultValue="product" style={{width: 280}}>
      <SelectGroup label="Pages">
        <SelectItem value="page" icon={IcRoundDescription}>
          Page
        </SelectItem>
        <SelectItem
          value="product"
          icon={IcRoundImage}
          description="A product with price and photos"
        >
          Product
        </SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup label="Blog">
        <SelectItem value="post" icon={IcRoundFeed}>
          Blog post
        </SelectItem>
      </SelectGroup>
    </Select>
  )
}
