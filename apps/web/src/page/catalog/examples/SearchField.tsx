'use client'

import {SearchField} from 'alinea/components'

export function SearchFieldExample() {
  return (
    <SearchField
      aria-label="Search entries"
      placeholder="Search entries"
      defaultValue="linen"
      style={{width: 280}}
    />
  )
}
