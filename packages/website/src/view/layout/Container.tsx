import {fromModule} from '@alineacms/ui'
import {HTMLAttributes, PropsWithChildren} from 'react'
import css from './Container.module.scss'

const styles = fromModule(css)

export function Container(
  props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
) {
  return <div {...props} className={styles.root.mergeProps(props)()} />
}
