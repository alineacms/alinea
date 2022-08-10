import {HTMLAttributes, PropsWithChildren} from 'react'

import {fromModule} from '@alinea/ui'
import css from './DemoContainer.module.scss'

const styles = fromModule(css)

type DemoContainerProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

export function DemoContainer(props: DemoContainerProps) {
  return <div {...props} className={styles.root.mergeProps(props)()} />
}

export function DemoSmallContainer(props: DemoContainerProps) {
  return <div {...props} className={styles.root('small')} />
}
