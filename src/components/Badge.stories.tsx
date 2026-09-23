import type {CSSProperties} from 'react'
import {
  IcRoundArchive,
  IcRoundCheck,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundPublic,
  IcRoundVisibility
} from '../dashboard/icons.js'
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
        <Badge icon={IcRoundPublic} size="sm">
          Shared
        </Badge>
      </div>

      <h2 style={headingStyle}>Compact multi-select</h2>
      <div style={rowStyle}>
        <Badge size="sm">Web</Badge>
        <Badge size="sm">App</Badge>
        <Badge size="sm">Email</Badge>
      </div>

      <h2 style={headingStyle}>Reference statuses</h2>
      <div style={rowStyle}>
        <Badge icon={IcRoundCheck} status="published">
          Published
        </Badge>
        <Badge icon={IcRoundEdit} status="draft">
          Draft
        </Badge>
        <Badge icon={IcRoundFlashOn} status="unpublished">
          Unpublished
        </Badge>
        <Badge icon={IcRoundArchive} status="archived">
          Archived
        </Badge>
      </div>

      <h2 style={headingStyle}>Details bar</h2>
      <div style={rowStyle}>
        <Badge icon={IcRoundVisibility} status="published">
          Published
        </Badge>
      </div>

      <h2 style={headingStyle}>Sidebar editing state</h2>
      <div style={rowStyle}>
        <Badge icon={IcRoundEdit} size="sm">
          Editing
        </Badge>
      </div>

      <h2 style={headingStyle}>Long labels truncate</h2>
      <div style={{...rowStyle, maxWidth: 320, flexWrap: 'nowrap'}}>
        <Badge icon={IcRoundPublic} size="sm">
          A very long shared label that should be truncated
        </Badge>
        <Badge icon={IcRoundPublic} size="sm">
          A very long shared label that should be truncated
        </Badge>
      </div>
    </div>
  )
}

export default {
  title: 'Pure components / Badge'
}
