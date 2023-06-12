import {fromModule} from 'alinea/ui/util/Styler'
import {HTMLAttributes, PropsWithChildren, ReactNode} from 'react'
import css from './Layout.module.scss'
import {NavSidebar} from './NavSidebar'

const styles = fromModule(css)

export type LayoutTheme = 'system' | 'dark' | 'light'

export function LayoutContent({children}: PropsWithChildren<{}>) {
  return <div className={styles.content()}>{children}</div>
}

export function LayoutScrollable({children}: PropsWithChildren<{}>) {
  return (
    <div className={styles.scrollable()}>
      <div className={styles.scrollable.inner()}>{children}</div>
    </div>
  )
}

interface WithSidebarProps {
  sidebar?: ReactNode
}

export function LayoutWithSidebar({
  children,
  sidebar
}: PropsWithChildren<WithSidebarProps>) {
  return (
    <LayoutContainer>
      <div className={styles.withSidebar()}>
        <NavSidebar>{sidebar}</NavSidebar>
        <LayoutScrollable>{children}</LayoutScrollable>
      </div>
    </LayoutContainer>
  )
}

export function LayoutContainer(
  props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
) {
  return <div {...props} className={styles.container.mergeProps(props)()} />
}
