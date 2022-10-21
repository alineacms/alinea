import {fromModule} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import css from './DemoLayout.module.scss'

const styles = fromModule(css)

export function DemoLayout({children}: PropsWithChildren<{}>) {
  return <div className={styles.root()}>{children}</div>
}
