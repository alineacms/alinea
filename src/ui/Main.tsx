import {HTMLProps, ReactNode} from 'react'
import css from './Main.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export interface MainProps extends HTMLProps<HTMLDivElement> {
  head?: ReactNode
}

export function Main({children, head, ...props}: MainProps) {
  return (
    <div className={styles.root()}>
      {head}
      <div {...props} className={styles.root.inner.mergeProps(props)()}>
        {children}
      </div>
    </div>
  )
}

export namespace Main {
  export const Container = styles.container.toElement('div')
}
