import {HTMLProps, memo, useEffect, useRef} from 'react'
import css from './Ellipsis.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export const Ellipsis = memo(function Ellipsis({
  children,
  ...props
}: HTMLProps<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && typeof children !== 'string') {
      const {textContent} = ref.current
      if (textContent) ref.current.setAttribute('title', textContent.trim())
    }
  }, [children])
  return (
    <div
      {...props}
      className={styles.root.mergeProps(props)()}
      title={typeof children === 'string' ? children : undefined}
      ref={ref}
    >
      {children}
    </div>
  )
})
