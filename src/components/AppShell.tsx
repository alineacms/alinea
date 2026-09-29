import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './AppShell.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface AppShellProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/**
 * The full height application layout: a NavRail next to the AppShellContent
 * surface that holds the sidebars and pages.
 */
export function AppShell({className, ...props}: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      {...props}
      className={styles.AppShell(styler.merge({className}))}
    />
  )
}

export interface AppShellContentProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** The raised surface next to the NavRail, rendered as the main landmark */
export function AppShellContent({className, ...props}: AppShellContentProps) {
  return (
    <main
      data-slot="app-shell-content"
      {...props}
      className={styles.AppShellContent(styler.merge({className}))}
    />
  )
}
