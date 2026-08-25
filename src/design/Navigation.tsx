import styler from '@alinea/styler'
import type {CSSProperties, PropsWithChildren, ReactNode} from 'react'
import css from './Navigation.module.css'

const styles = styler(css)

export interface NavigationProps extends PropsWithChildren {
  label: string
}

export function Navigation({children, label}: NavigationProps) {
  return (
    <nav aria-label={label} className={styles['alinea-Navigation']()}>
      {children}
    </nav>
  )
}

export function NavigationSection({children}: PropsWithChildren) {
  return <div className={styles['alinea-Navigation-section']()}>{children}</div>
}

export function NavigationHeading({children}: PropsWithChildren) {
  return <h2 className={styles['alinea-Navigation-heading']()}>{children}</h2>
}

export interface NavigationItemProps {
  depth?: number
  disabled?: boolean
  icon?: ReactNode
  label: string
  meta?: ReactNode
  selected?: boolean
}

export function NavigationItem({
  depth = 0,
  disabled,
  icon,
  label,
  meta,
  selected
}: NavigationItemProps) {
  return (
    <button
      className={styles['alinea-Navigation-item']()}
      data-disabled={disabled ? '' : undefined}
      data-selected={selected ? '' : undefined}
      disabled={disabled}
      style={{'--alinea-Navigation-depth': depth} as CSSProperties}
      type="button"
    >
      {icon && (
        <span className={styles['alinea-Navigation-icon']()}>{icon}</span>
      )}
      <span className={styles['alinea-Navigation-label']()}>{label}</span>
      {meta && (
        <span className={styles['alinea-Navigation-meta']()}>{meta}</span>
      )}
    </button>
  )
}
