import styler from '@alinea/styler'
import {PropsWithChildren} from 'react'
import css from './DemoLayout.module.scss'

const styles = styler(css)

export function DemoLayout({children}: PropsWithChildren<{}>) {
  return <div className={styles.root()}>{children}</div>
}
