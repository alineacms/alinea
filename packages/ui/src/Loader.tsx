import {HTMLAttributes} from 'react'
import css from './Loader.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

type LoaderProps = {
  light?: boolean
  absolute?: boolean
} & HTMLAttributes<HTMLDivElement>

export function Loader({light, absolute, ...props}: LoaderProps) {
  return (
    <div className={styles.loader.mergeProps(props).mod({absolute})()}>
      <div
        {...props}
        className={styles.loader.inner()}
        style={{
          ...props.style,
          borderColor: `var(--foreground) transparent transparent transparent`
        }}
      ></div>
    </div>
  )
}
