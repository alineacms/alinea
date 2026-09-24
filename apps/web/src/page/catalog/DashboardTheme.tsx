import 'alinea/css'
import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './DashboardTheme.module.scss'

const styles = styler(css)

export interface DashboardThemeProps {
  className?: string
  children: ReactNode
}

/**
 * Renders dashboard components with the dashboard font and theme. The site's
 * own typography stays outside, the light or dark scheme follows the site.
 */
export function DashboardTheme({className, children}: DashboardThemeProps) {
  return (
    <div className={styles.root(styler.merge({className}))}>{children}</div>
  )
}
