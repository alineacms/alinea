import type {CSSProperties} from 'react'
import {Badge, type ContentStatus} from '#/components.js'
import {EntrySidebarVersionRow} from './EntrySidebar.js'

const storyStyle: CSSProperties = {
  width: 322,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 24
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8
}

const headingStyle: CSSProperties = {
  margin: 0,
  color: 'var(--alinea-fg-muted)',
  fontSize: 'var(--alinea-font-size-base)',
  fontWeight: 500,
  lineHeight: 1
}

const rows: Array<{status: ContentStatus; title: string}> = [
  {status: 'published', title: 'Published'},
  {status: 'draft', title: 'Draft'},
  {status: 'unpublished', title: 'Unpublished'},
  {status: 'archived', title: 'Archived'}
]

const listStyle: CSSProperties = {margin: 0, padding: 0, listStyle: 'none'}

interface VersionRowsProps {
  selected?: boolean
  showEditing?: boolean
}

function VersionRows({selected, showEditing}: VersionRowsProps) {
  return (
    <ul style={listStyle}>
      {rows.map(row => (
        <EntrySidebarVersionRow
          key={row.status}
          selected={selected && row.status === 'draft'}
          title={<Badge status={row.status}>{row.title}</Badge>}
          meta="Stijn Codeurs · 2 hours ago"
        >
          {showEditing && row.status === 'draft' && 'Editing'}
        </EntrySidebarVersionRow>
      ))}
    </ul>
  )
}

export function VersionRowStates() {
  return (
    <div style={storyStyle}>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Unselected</h2>
        <VersionRows />
      </section>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Selected</h2>
        <VersionRows selected />
      </section>
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Editing</h2>
        <VersionRows selected showEditing />
      </section>
    </div>
  )
}

export default {
  title: 'Dashboard / EntrySidebar'
}
