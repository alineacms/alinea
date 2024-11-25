import styler from '@alinea/styler'
import {HTMLAttributes} from 'react'
import css from './Loader.module.scss'

const styles = styler(css)

type LoaderProps = {
  light?: boolean
  absolute?: boolean
  size?: number
} & HTMLAttributes<HTMLDivElement>

export function Loader({light, absolute, size = 22, ...props}: LoaderProps) {
  return (
    <div
      style={{fontSize: size}}
      className={styles.loader.mergeProps(props)({absolute})}
    >
      <div {...props} className={styles.loader.inner()}></div>
    </div>
  )
}
