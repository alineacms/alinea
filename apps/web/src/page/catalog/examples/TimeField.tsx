'use client'

import {TimeField} from 'alinea/components'

export function TimeFieldExample() {
  return (
    <TimeField
      label="Opening time"
      defaultValue="09:30"
      hourCycle={24}
      style={{width: 180}}
    />
  )
}
