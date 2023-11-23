import {assign} from 'alinea/core/util/Objects'
import {HTMLProps, ReactNode, Ref, forwardRef} from 'react'
import {Loader} from './Loader.js'
import css from './Main.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export interface MainProps extends HTMLProps<HTMLDivElement> {
  head?: ReactNode
  scrollRef?: Ref<HTMLDivElement>
  scrollable?: boolean
  isLoading?: boolean
}

function MainRoot(
  {
    children,
    head,
    scrollRef,
    isLoading,
    scrollable = true,
    ...props
  }: MainProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} className={styles.root({scrollable, loading: isLoading})}>
      {head}
      <div
        ref={scrollRef}
        {...props}
        className={styles.root.inner.mergeProps(props)()}
      >
        {children}
      </div>
      {isLoading && (
        <div className={styles.root.loading()}>
          <Loader absolute />
        </div>
      )}
    </div>
  )
}

const MainContainer = styles.container.toElement('div')

export const Main = assign(forwardRef(MainRoot), {
  Container: MainContainer
})
