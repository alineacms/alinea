import {useState} from 'react'
import {Button} from './Button.js'
import {FoldIcon} from './FoldIcon.js'

export function Example() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <FoldIcon aria-hidden expanded={expanded} />
        Details
      </Button>
    </div>
  )
}

export function States() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <FoldIcon aria-label="Collapsed" />
      <FoldIcon aria-label="Expanded" expanded />
    </div>
  )
}

export default {
  title: 'Pure components / FoldIcon'
}
