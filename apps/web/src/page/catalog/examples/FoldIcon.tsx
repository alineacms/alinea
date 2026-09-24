'use client'

import {Button, FoldIcon} from 'alinea/components'
import {useState} from 'react'

export function FoldIconExample() {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <FoldIcon aria-label="Collapsed" />
      <FoldIcon aria-label="Expanded" expanded />
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <FoldIcon aria-hidden expanded={expanded} />
        Care instructions
      </Button>
    </>
  )
}
