'use client'

import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Timestamp
} from 'alinea/components'

export function TimestampExample() {
  return (
    <DataList aria-label="Linen shirt" style={{width: 320}}>
      <DataListItem>
        <DataListLabel>Published</DataListLabel>
        <DataListValue>
          <Timestamp date="2026-09-14T09:30:00Z" format="date" />
        </DataListValue>
      </DataListItem>
      <DataListItem>
        <DataListLabel>Last edited</DataListLabel>
        <DataListValue>
          <Timestamp date="2026-09-22T16:05:00Z" format="relative" />
        </DataListValue>
      </DataListItem>
    </DataList>
  )
}
