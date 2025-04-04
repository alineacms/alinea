import styler from '@alinea/styler'
import {assign} from 'alinea/core/util/Objects'
import {type HTMLProps, type ReactNode, type Ref, forwardRef} from 'react'
import {Loader} from './Loader.js'
import css from './Main.module.scss'

const styles = styler(css)

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

function MainContainer(props: HTMLProps<HTMLDivElement>) {
  return <div {...props} className={styles.container(styler.merge(props))} />
}

export const Main = assign(forwardRef(MainRoot), {
  Container: MainContainer
})
