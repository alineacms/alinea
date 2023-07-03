import {assign} from 'alinea/core/util/Objects'
import {HTMLProps, ReactNode, Ref, forwardRef} from 'react'
import css from './Main.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export interface MainProps extends HTMLProps<HTMLDivElement> {
  head?: ReactNode
  scrollRef?: Ref<HTMLDivElement>
}

function MainRoot(
  {children, head, scrollRef, ...props}: MainProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} className={styles.root()}>
      {head}
      <div
        ref={scrollRef}
        {...props}
        className={styles.root.inner.mergeProps(props)()}
      >
        {children}
      </div>
    </div>
  )
}

const MainContainer = styles.container.toElement('div')

export const Main = assign(forwardRef(MainRoot), {
  Container: MainContainer
})
