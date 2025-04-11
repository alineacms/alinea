import styler from '@alinea/styler'
import {type HTMLProps, memo} from 'react'
import css from './Ellipsis.module.scss'

const styles = styler(css)

export const Ellipsis = memo(function Ellipsis({
  children,
  ...props
}: HTMLProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={styles.root.mergeProps(props)()}
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </div>
  )
})
