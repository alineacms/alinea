'use client'

import {NumberField} from 'alinea/components'

export function NumberFieldExample() {
  return (
    <NumberField
      label="Price"
      defaultValue={89}
      min={0}
      formatOptions={{style: 'currency', currency: 'EUR'}}
      style={{width: 220}}
    />
  )
}
