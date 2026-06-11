import type {CSSProperties} from 'react'
import {
  IcRoundArchive,
  IcRoundCheck,
  IcRoundEdit,
  IcRoundPublic,
  IcRoundVisibility
} from '../icons.js'
import {Badge} from './Badge.js'

const storyStyle: CSSProperties = {
  padding: 24,
  display: 'grid',
  gap: 18,
  alignItems: 'start'
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10
}

const headingStyle: CSSProperties = {
  margin: 0,
  color: 'var(--alinea-fg-muted)',
  fontSize: 'var(--alinea-font-size-base)',
  fontWeight: 500,
  lineHeight: 1
}

export function Usages() {
  return (
    <div style={storyStyle}>
      <h2 style={headingStyle}>Shared label</h2>
      <div style={rowStyle}>
        <Badge
          appearance="background"
          icon={IcRoundPublic}
          size="small"
          status="accent"
        >
          Shared
        </Badge>
      </div>

      <h2 style={headingStyle}>Compact multi-select</h2>
      <div style={rowStyle}>
        <Badge appearance="background" size="small">
          Web
        </Badge>
        <Badge appearance="background" size="small">
          App
        </Badge>
        <Badge appearance="background" size="small">
          Email
        </Badge>
      </div>

      <h2 style={headingStyle}>Reference statuses</h2>
      <div style={rowStyle}>
        <Badge icon={IcRoundCheck} status="success">
          Published
        </Badge>
        <Badge icon={IcRoundEdit} status="warning">
          Draft
        </Badge>
        <Badge icon={IcRoundArchive} status="neutral">
          Archived
        </Badge>
        <Badge status="danger">Failed</Badge>
      </div>

      <h2 style={headingStyle}>Details bar</h2>
      <div style={rowStyle}>
        <Badge appearance="plain" icon={IcRoundVisibility}>
          Published
        </Badge>
      </div>

      <h2 style={headingStyle}>Sidebar editing state</h2>
      <div style={rowStyle}>
        <Badge appearance="background" icon={IcRoundEdit} size="small">
          Editing
        </Badge>
      </div>
    </div>
  )
}

export default {
  title: 'Dashboard / Badge'
}
