'use client'

import {DateField} from 'alinea/components'

export function DateFieldExample() {
  return (
    <DateField
      label="Publish date"
      defaultValue="2026-09-23"
      style={{width: 220}}
    />
  )
}
