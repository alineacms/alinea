'use client'

import {Select, SelectItem} from 'alinea/components'

export function SelectExample() {
  return (
    <Select label="Status" defaultValue="published" style={{width: 260}}>
      <SelectItem value="draft">Draft</SelectItem>
      <SelectItem value="published">Published</SelectItem>
      <SelectItem value="archived">Archived</SelectItem>
    </Select>
  )
}
