import {fromModule} from 'alinea/ui'
import {PropsWithChildren} from 'react'
import css from './Preview.module.scss'
import {Sidebar} from './Sidebar.js'

const styles = fromModule(css)

export type PreviewProps = PropsWithChildren<{}>

export function Preview({children}: PreviewProps) {
  return (
    <Sidebar.Preview>
      <div className={styles.root()}>{children}</div>
    </Sidebar.Preview>
  )
}
