import type {CSSProperties} from 'react'
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue
} from './DataList.js'
import {Link} from './Link.js'
import {Timestamp} from './Timestamp.js'

const storyStyle: CSSProperties = {
  display: 'grid',
  gap: 40,
  maxWidth: 640,
  padding: 24
}

export function Horizontal() {
  return (
    <div style={storyStyle}>
      <DataList aria-label="Entry details">
        <DataListItem>
          <DataListLabel>Status</DataListLabel>
          <DataListValue>Published</DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Created by</DataListLabel>
          <DataListValue>Els Peeters</DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Last modified</DataListLabel>
          <DataListValue>
            <Timestamp date="2026-09-20T14:30:00Z" locale="en-GB" />
          </DataListValue>
        </DataListItem>
      </DataList>
    </div>
  )
}

export function Vertical() {
  return (
    <div style={storyStyle}>
      <DataList orientation="vertical" aria-label="File details">
        <DataListItem>
          <DataListLabel>Extension</DataListLabel>
          <DataListValue>.jpg</DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>File size</DataListLabel>
          <DataListValue>245 kB</DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Dimensions</DataListLabel>
          <DataListValue>1920px x 1080px</DataListValue>
        </DataListItem>
        <DataListItem full>
          <DataListLabel>URL</DataListLabel>
          <DataListValue>
            <Link href="https://example.com/media/team.jpg">
              https://example.com/media/a-very-long-folder-name/team-photo.jpg
            </Link>
          </DataListValue>
        </DataListItem>
      </DataList>
    </div>
  )
}

export default {
  title: 'Pure components / DataList'
}
