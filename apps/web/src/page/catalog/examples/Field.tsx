'use client'

import {Field} from 'alinea/components'

export function FieldExample() {
  return (
    <Field
      label="Image focus"
      description="Horizontal focal point of the hero image"
      htmlFor="focus"
      style={{width: 280}}
    >
      <input id="focus" type="range" min={0} max={100} defaultValue={40} />
    </Field>
  )
}
