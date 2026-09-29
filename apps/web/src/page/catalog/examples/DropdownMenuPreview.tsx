'use client'

import {Button, Kbd} from 'alinea/components'
import {
  IcBaselineContentCopy,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundMoreHoriz
} from 'alinea/dashboard/icons'
import type {CSSProperties} from 'react'

// An open menu would take focus, the catalog thumbnail draws one with
// buttons in a frame styled like the menu
const menu: CSSProperties = {
  display: 'grid',
  width: 190,
  padding: 4,
  border: '1px solid var(--alinea-border)',
  borderRadius: 'var(--alinea-radius)',
  background: 'var(--alinea-input)',
  boxShadow: 'var(--alinea-shadow-tooltip)'
}

const item: CSSProperties = {justifyContent: 'flex-start', width: '100%'}

export function DropdownMenuPreviewExample() {
  return (
    <div style={{display: 'grid', gap: 6, justifyItems: 'start'}}>
      <Button
        variant="outline"
        size="icon"
        icon={IcRoundMoreHoriz}
        aria-label="Actions"
      />
      <div style={menu}>
        <Button variant="ghost" icon={IcRoundEdit} style={item} active>
          Rename <Kbd style={{marginLeft: 'auto'}}>⌘R</Kbd>
        </Button>
        <Button variant="ghost" icon={IcBaselineContentCopy} style={item}>
          Duplicate
        </Button>
        <Button
          variant="ghost"
          color="destructive"
          icon={IcRoundDelete}
          style={item}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
