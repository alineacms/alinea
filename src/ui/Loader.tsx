import {HTMLAttributes} from 'react'
import css from './Loader.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

type LoaderProps = {
  light?: boolean
  absolute?: boolean
  small?: boolean
} & HTMLAttributes<HTMLDivElement>

export function Loader({light, absolute, small, ...props}: LoaderProps) {
  return (
    <div className={styles.loader.mergeProps(props)({small, absolute})}>
      <div
        {...props}
        className={styles.loader.inner()}
        style={{
          ...props.style,
          borderColor: `var(--alinea-foreground) transparent transparent transparent`
        }}
      ></div>
    </div>
  )
}
