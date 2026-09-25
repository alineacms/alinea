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
 * The dashboard stylesheet is imported along with the components rendered
 * inside, so pages without them don't load it.
 */
export function DashboardTheme({className, children}: DashboardThemeProps) {
  return (
    <div className={styles.root(styler.merge({className}))}>{children}</div>
  )
}
