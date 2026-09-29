'use client'

import {RadioGroup, RadioGroupItem} from 'alinea/components'

export function RadioGroupExample() {
  return (
    <RadioGroup label="Visibility" defaultValue="public">
      <RadioGroupItem value="public">Public</RadioGroupItem>
      <RadioGroupItem value="unlisted">Unlisted</RadioGroupItem>
      <RadioGroupItem value="private">Private</RadioGroupItem>
    </RadioGroup>
  )
}
