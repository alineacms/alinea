'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Text
} from 'alinea/components'

export function CollapsibleExample() {
  return (
    <Collapsible defaultOpen style={{width: 320}}>
      <CollapsibleTrigger>Care instructions</CollapsibleTrigger>
      <CollapsibleContent>
        <Text as="p">Machine wash at 40°C.</Text>
        <Text as="p">Tumble dry low, iron while damp.</Text>
      </CollapsibleContent>
    </Collapsible>
  )
}
