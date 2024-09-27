import styler from '@alinea/styler'
import {PropsWithChildren} from 'react'
import css from './DemoPage.module.scss'

const styles = styler(css)

export function DemoPage({children}: PropsWithChildren<{}>) {
  return <main className={styles.root()}>{children}</main>
}

export namespace DemoPage {
  export function Container({children}: PropsWithChildren<{}>) {
    return <div className={styles.container()}>{children}</div>
  }
}
