import {HTMLProps} from 'react'
import css from './Main.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export function Main({children, ...props}: HTMLProps<HTMLDivElement>) {
  return (
    <div {...props} className={styles.root()}>
      <div className={styles.root.inner.mergeProps(props)()}>{children}</div>
    </div>
  )
}

export namespace Main {
  export const Container = styles.container.toElement('div')
}
