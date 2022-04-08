import {fromModule, Pane} from '@alineacms/ui'
import {PropsWithChildren} from 'react'
import css from './Preview.module.scss'

const styles = fromModule(css)

export type PreviewProps = PropsWithChildren<{}>

export function Preview({children}: PreviewProps) {
  return (
    <Pane id="preview" resizable="left" defaultWidth={330} minWidth={320}>
      <div className={styles.root()}>{children}</div>
    </Pane>
  )
}
