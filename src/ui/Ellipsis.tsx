import {HTMLProps, memo} from 'react'
import css from './Ellipsis.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

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
