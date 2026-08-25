import styler from '@alinea/styler'
import type {CSSProperties, PropsWithChildren} from 'react'
import css from './AppShell.module.css'

const styles = styler(css)

export interface AppShellProps extends PropsWithChildren {
  height?: number
}

export function AppShell({children, height = 720}: AppShellProps) {
  return (
    <main
      className={styles['alinea-AppShell']()}
      style={{'--alinea-AppShell-height': `${height}px`} as CSSProperties}
    >
      {children}
    </main>
  )
}

export function AppShellInner({children}: PropsWithChildren) {
  return <div className={styles['alinea-AppShell-inner']()}>{children}</div>
}

export interface AppShellSidebarProps extends PropsWithChildren {
  label: string
  width?: number
}

export function AppShellSidebar({
  children,
  label,
  width = 32
}: AppShellSidebarProps) {
  return (
    <aside
      aria-label={label}
      className={styles['alinea-AppShell-sidebar']()}
      style={{'--alinea-AppShell-sidebar-width': `${width}px`} as CSSProperties}
    >
      {children}
    </aside>
  )
}

export function AppShellContent({children}: PropsWithChildren) {
  return <div className={styles['alinea-AppShell-content']()}>{children}</div>
}
