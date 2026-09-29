'use client'

import {TextField} from 'alinea/components'

export function TextFieldMultilineExample() {
  return (
    <TextField
      label="Description"
      multiline
      rows={4}
      defaultValue="A relaxed shirt in washed linen that softens with every wear."
      style={{width: 300}}
    />
  )
}
