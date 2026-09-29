'use client'

import {TextField} from 'alinea/components'
import {
  IcRoundLink,
  IcRoundOpenInNew,
  IcRoundSearch
} from 'alinea/dashboard/icons'

export function TextFieldIconsExample() {
  return (
    <div style={{display: 'grid', gap: 16, width: 280}}>
      <TextField
        aria-label="Search products"
        placeholder="Search products"
        startIcon={IcRoundSearch}
      />
      <TextField
        label="Website"
        type="url"
        defaultValue="https://oakandloom.com"
        startIcon={IcRoundLink}
        endIcon={IcRoundOpenInNew}
      />
    </div>
  )
}
