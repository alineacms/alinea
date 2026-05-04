import '#/theme.css'
import type {CSSProperties} from 'react'
import {
  IcOutlineArchive,
  IcOutlineDrafts,
  IcRoundEdit,
  IcRoundVisibility,
  IcRoundVisibilityOff
} from '../icons.js'
import {
  EntrySidebarVersionRow,
  type EntrySidebarVersionStatus
} from './EntrySidebar.js'

const storyStyle: CSSProperties = {
  width: 322,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 24
}

const groupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8
}

const headingStyle: CSSProperties = {
  margin: 0,
  color: 'var(--alinea-content-secondary)',
  fontSize: 'var(--alinea-font-size-base)',
  fontWeight: 500,
  lineHeight: 1
}

const rows = [
  {
    status: 'none',
    icon: IcOutlineDrafts,
    title: 'No status'
  },
  {
    status: 'published',
    icon: IcRoundVisibility,
    title: 'Published'
  },
  {
    status: 'draft',
    icon: IcRoundEdit,
    title: 'Draft'
  },
  {
    status: 'unpublished',
    icon: IcRoundVisibilityOff,
    title: 'Unpublished'
  },
  {
    status: 'archived',
    icon: IcOutlineArchive,
    title: 'Archived'
  }
] satisfies Array<{
  status: EntrySidebarVersionStatus
  icon: typeof IcRoundVisibility
  title: string
}>

function VersionRows({selected}: {selected?: boolean}) {
  return (
    <div style={groupStyle}>
      {rows.map(row => (
        <EntrySidebarVersionRow
          key={row.status}
          selected={selected}
          status={row.status}
          icon={row.icon}
          title={row.title}
          meta="Stijn Codeurs - Today at 10:40"
        />
      ))}
    </div>
  )
}

export function VersionRowStates() {
  return (
    <div style={storyStyle}>
      <section style={groupStyle}>
        <h2 style={headingStyle}>Unselected</h2>
        <VersionRows />
      </section>
      <section style={groupStyle}>
        <h2 style={headingStyle}>Selected</h2>
        <VersionRows selected />
      </section>
    </div>
  )
}

export default {
  title: 'Dashboard / EntrySidebar'
}
