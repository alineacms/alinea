'use client'

import {
  Badge,
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue
} from 'alinea/components'

export function DataListExample() {
  return (
    <DataList aria-label="Entry details" style={{width: 300}}>
      <DataListItem>
        <DataListLabel>Status</DataListLabel>
        <DataListValue>
          <Badge size="sm" status="published">
            Published
          </Badge>
        </DataListValue>
      </DataListItem>
      <DataListItem>
        <DataListLabel>Created by</DataListLabel>
        <DataListValue>Maya Janssens</DataListValue>
      </DataListItem>
      <DataListItem>
        <DataListLabel>Path</DataListLabel>
        <DataListValue>/products/linen-shirt</DataListValue>
      </DataListItem>
    </DataList>
  )
}
