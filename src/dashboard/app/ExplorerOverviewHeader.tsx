import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './ExplorerOverviewHeader.module.css'

const styles = styler(css)

export interface ExplorerOverviewHeaderProps {
  children: ReactNode
}

/** Places the `overview.header` view between the toolbar and the list */
export function ExplorerOverviewHeader({
  children
}: ExplorerOverviewHeaderProps) {
  return (
    <div
      className={styles.ExplorerOverviewHeader()}
      data-slot="overview-header"
    >
      {children}
    </div>
  )
}
