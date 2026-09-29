import type {CSSProperties} from 'react'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue
} from './DataList.js'
import {Timestamp} from './Timestamp.js'

const storyStyle: CSSProperties = {
  maxWidth: 640,
  padding: 24
}

const date = '2026-03-14T09:26:53Z'
const minute = 60_000

export function Formats() {
  return (
    <div style={storyStyle}>
      <DataList aria-label="Formats">
        <DataListItem>
          <DataListLabel>datetime</DataListLabel>
          <DataListValue>
            <Timestamp date={date} locale="en-US" />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>date</DataListLabel>
          <DataListValue>
            <Timestamp date={date} format="date" locale="en-US" />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>time</DataListLabel>
          <DataListValue>
            <Timestamp date={date} format="time" locale="en-US" />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>nl-BE</DataListLabel>
          <DataListValue>
            <Timestamp date={date} locale="nl-BE" />
          </DataListValue>
        </DataListItem>
      </DataList>
    </div>
  )
}

export function Relative() {
  const now = Date.now()
  return (
    <div style={storyStyle}>
      <DataList aria-label="Relative">
        <DataListItem>
          <DataListLabel>Just now</DataListLabel>
          <DataListValue>
            <Timestamp date={now} format="relative" locale="en-US" />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Minutes</DataListLabel>
          <DataListValue>
            <Timestamp
              date={now - 5 * minute}
              format="relative"
              locale="en-US"
            />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Hours</DataListLabel>
          <DataListValue>
            <Timestamp
              date={now - 3 * 60 * minute}
              format="relative"
              locale="en-US"
            />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Yesterday</DataListLabel>
          <DataListValue>
            <Timestamp
              date={now - 24 * 60 * minute}
              format="relative"
              locale="en-US"
            />
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Last year</DataListLabel>
          <DataListValue>
            <Timestamp
              date={new Date(new Date(now).getFullYear() - 1, 4, 3)}
              format="relative"
              locale="en-US"
            />
          </DataListValue>
        </DataListItem>
      </DataList>
    </div>
  )
}

export default {
  title: 'Pure components / Timestamp'
}
