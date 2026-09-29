import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './DemoContainer.module.scss'

const styles = styler(css)

export interface DemoContainerProps {
  /** Narrow is used for text heavy content like articles */
  width?: 'wide' | 'narrow'
  className?: string
  children: ReactNode
}

export function DemoContainer({
  width = 'wide',
  className,
  children
}: DemoContainerProps) {
  return (
    <div
      className={styles.DemoContainer(
        {[width]: true},
        styler.merge({className})
      )}
    >
      {children}
    </div>
  )
}
