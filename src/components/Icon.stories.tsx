import * as icons from '#/dashboard/icons.js'
import {
  IcRoundCheck,
  IcRoundDelete,
  IcRoundLink,
  IcRoundSearch
} from '#/dashboard/icons.js'
import {Icon} from './Icon.js'
import type {IconType} from './types.js'

const gallery = Object.entries(icons as Record<string, IconType>).sort(
  ([a], [b]) => a.localeCompare(b)
)

export function Gallery() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 8,
        padding: 24,
        fontSize: 13
      }}
    >
      {gallery.map(([name, icon]) => (
        <div
          key={name}
          style={{display: 'flex', alignItems: 'center', gap: 12}}
        >
          <Icon icon={icon} style={{fontSize: 20}} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <Icon icon={IcRoundSearch} style={{fontSize: 12}} />
      <Icon icon={IcRoundSearch} style={{fontSize: 16}} />
      <Icon icon={IcRoundSearch} style={{fontSize: 24}} />
      <Icon icon={IcRoundSearch} style={{fontSize: 32}} />
    </div>
  )
}

export function Colors() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <span style={{color: 'var(--alinea-fg-muted)'}}>
        <Icon icon={IcRoundLink} />
      </span>
      <span style={{color: 'var(--alinea-success)'}}>
        <Icon icon={IcRoundCheck} />
      </span>
      <span style={{color: 'var(--alinea-danger)'}}>
        <Icon icon={IcRoundDelete} />
      </span>
    </div>
  )
}

export function Labelled() {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: 24}}>
      <Icon icon={IcRoundCheck} aria-label="Published" />
      <Icon icon={IcRoundLink} data-testid="decorative" />
    </div>
  )
}

export default {
  title: 'Pure components / Icon'
}
