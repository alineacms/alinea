'use client'

import {Select, SelectItem} from 'alinea/components'

export function SelectStatesExample() {
  return (
    <div style={{display: 'grid', gap: 16, width: 280}}>
      <Select label="Category" placeholder="Choose a category">
        <SelectItem value="bedroom">Bedroom</SelectItem>
        <SelectItem value="dining">Dining</SelectItem>
      </Select>
      <Select label="Locale" defaultValue="en" disabled>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="nl">Nederlands</SelectItem>
      </Select>
      <Select label="Status" required error="Pick a status to continue">
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="published">Published</SelectItem>
      </Select>
    </div>
  )
}
