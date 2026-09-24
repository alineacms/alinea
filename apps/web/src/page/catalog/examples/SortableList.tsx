'use client'

import {
  Badge,
  type DragMoveEvent,
  SortableList,
  SortableListHandle,
  SortableListItem,
  SortableListItemDescription,
  SortableListItemHeader,
  SortableListItemTitle
} from 'alinea/components'
import {useState} from 'react'

const initial = [
  {id: 'hero', type: 'Hero', label: 'Autumn collection'},
  {id: 'products', type: 'Products', label: 'New in linen'},
  {id: 'quote', type: 'Quote', label: 'From the workshop'}
]

export function SortableListExample() {
  const [sections, setSections] = useState(initial)
  function reorder({keys, target}: DragMoveEvent) {
    const moved = sections.filter(section => keys.has(section.id))
    const rest = sections.filter(section => !keys.has(section.id))
    const index = rest.findIndex(section => section.id === target.key)
    rest.splice(target.position === 'before' ? index : index + 1, 0, ...moved)
    setSections(rest)
  }
  return (
    <SortableList
      aria-label="Sections"
      onReorder={reorder}
      style={{width: 400}}
    >
      {sections.map(section => (
        <SortableListItem key={section.id} id={section.id} role="listitem">
          <SortableListItemHeader>
            <SortableListHandle aria-label={`Drag ${section.label}`} />
            <SortableListItemTitle>
              <Badge size="sm">{section.type}</Badge>
              <SortableListItemDescription>
                {section.label}
              </SortableListItemDescription>
            </SortableListItemTitle>
          </SortableListItemHeader>
        </SortableListItem>
      ))}
    </SortableList>
  )
}
