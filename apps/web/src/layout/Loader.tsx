import styler from '@alinea/styler'
import css from './Loader.module.scss'

const styles = styler(css)

export interface LoaderProps {
  absolute?: boolean
  size?: number
  light?: boolean
}

export function Loader({absolute, size = 22}: LoaderProps) {
  return (
    <div style={{fontSize: size}} className={styles.root({absolute})}>
      <div className={styles.root.inner()} />
    </div>
  )
}