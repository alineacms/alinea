import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import type {DemoLayoutData} from '../demoData'
import {DemoFooter} from './DemoFooter'
import {DemoHeader} from './DemoHeader'
import css from './DemoSite.module.scss'

const styles = styler(css)

export interface DemoSiteProps {
  layout: DemoLayoutData
  children: ReactNode
}

/** The shell of the demo site: scoped theme, header and footer */
export function DemoSite({layout, children}: DemoSiteProps) {
  return (
    <div className={styles.DemoSite()} lang={layout.locale}>
      <DemoHeader {...layout} />
      <main className={styles.DemoSite.main()}>{children}</main>
      <DemoFooter {...layout} />
    </div>
  )
}
