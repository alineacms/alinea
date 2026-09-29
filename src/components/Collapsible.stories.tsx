import {useState} from 'react'
import {Button} from './Button.js'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './Collapsible.js'

export function Example() {
  return (
    <Collapsible>
      <CollapsibleTrigger>Previous versions</CollapsibleTrigger>
      <CollapsibleContent>
        <p>Version 3, published yesterday</p>
        <p>Version 2, published last week</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <p>{open ? 'Expanded' : 'Collapsed'}</p>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger>Details</CollapsibleTrigger>
        <CollapsibleContent>Some details</CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function AsChild() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline">Show more</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>More content</CollapsibleContent>
    </Collapsible>
  )
}

export function Disabled() {
  return (
    <Collapsible disabled>
      <CollapsibleTrigger>Locked</CollapsibleTrigger>
      <CollapsibleContent>Hidden content</CollapsibleContent>
    </Collapsible>
  )
}

export default {
  title: 'Pure components / Collapsible'
}
