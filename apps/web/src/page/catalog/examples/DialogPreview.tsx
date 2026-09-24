'use client'

import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'alinea/components'
import type {CSSProperties} from 'react'

// A real dialog takes over the page, the catalog thumbnail shows its parts
// in a frame styled like the dialog
const frame: CSSProperties = {
  display: 'grid',
  gap: 16,
  width: 280,
  padding: 22,
  border: '1px solid var(--alinea-border)',
  borderRadius: 'var(--alinea-radius-xl)',
  background: 'var(--alinea-overlay)',
  boxShadow: 'var(--alinea-shadow-modal)'
}

export function DialogPreviewExample() {
  return (
    <div style={frame}>
      <DialogHeader>
        <DialogTitle>Delete “Linen shirt”?</DialogTitle>
        <DialogDescription>This can’t be undone.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button color="destructive">Delete</Button>
      </DialogFooter>
    </div>
  )
}
