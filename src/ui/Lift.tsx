import {fromModule} from 'alinea/ui'
import {HTMLProps} from 'react'
import css from './Lift.module.scss'

const styles = fromModule(css)

export function Lift(props: HTMLProps<HTMLDivElement>) {
  return <div {...props} className={styles.root.mergeProps(props)()} />
}
