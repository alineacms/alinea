'use client'

import {TextField} from 'alinea/components'

export function TextFieldStatesExample() {
  return (
    <div style={{display: 'grid', gap: 16, width: 280}}>
      <TextField
        label="Slug"
        description="Used in the page URL"
        defaultValue="linen-shirt"
      />
      <TextField label="Title" required error="A title is required" />
      <TextField label="Author" defaultValue="Anna Peeters" disabled />
      <TextField label="Entry id" defaultValue="2mXhVzR4" readOnly />
    </div>
  )
}
