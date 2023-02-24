import {PropsWithChildren, ReactNode} from 'react'
import css from './Property.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export type PropertyProps = PropsWithChildren<{
  label: ReactNode
}>

export function Property({label, children}: PropertyProps) {
  return (
    <div className={styles.root()}>
      <div className={styles.root.label()}>{label}</div>
      <div className={styles.root.contents()}>{children}</div>
    </div>
  )
}
