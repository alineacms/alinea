import {fromModule} from 'alinea/ui'
import {PropsWithChildren} from 'react'
import css from './TypeRow.module.scss'

const styles = fromModule(css)

export function TypeRow({children}: PropsWithChildren<{}>) {
  return <div className={styles.root()}>{children}</div>
}
