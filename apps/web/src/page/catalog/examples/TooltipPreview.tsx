'use client'

import {Button} from 'alinea/components'
import {IcRoundOpenInNew} from 'alinea/dashboard/icons'
import type {CSSProperties} from 'react'

// Tooltips open on hover, the catalog thumbnail draws one in a frame styled
// like the tooltip
const tooltip: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 'var(--alinea-radius-sm)',
  background: 'var(--alinea-primary)',
  color: 'var(--alinea-primary-fg)',
  boxShadow: 'var(--alinea-shadow-tooltip)',
  lineHeight: 1.4
}

export function TooltipPreviewExample() {
  return (
    <div style={{display: 'grid', gap: 8, justifyItems: 'center'}}>
      <span style={tooltip}>Open preview in a new tab</span>
      <Button
        variant="outline"
        size="icon"
        icon={IcRoundOpenInNew}
        aria-label="Open preview"
      />
    </div>
  )
}
