import {fromModule} from 'alinea/ui/util/Styler'
import {HTMLAttributes, PropsWithChildren, ReactNode} from 'react'
import {NavSidebar} from './NavSidebar'
import css from './Page.module.scss'

const styles = fromModule(css)

export type PageTheme = 'system' | 'dark' | 'light'

export function PageContent({children}: PropsWithChildren<{}>) {
  return <div className={styles.content()}>{children}</div>
}

export function PageScrollable({children}: PropsWithChildren<{}>) {
  return (
    <div className={styles.scrollable()}>
      <div className={styles.scrollable.inner()}>{children}</div>
    </div>
  )
}

interface WithSidebarProps {
  sidebar?: ReactNode
}

export function PageWithSidebar({
  children,
  sidebar
}: PropsWithChildren<WithSidebarProps>) {
  return (
    <PageContainer>
      <div className={styles.withSidebar()}>
        <NavSidebar>{sidebar}</NavSidebar>
        <PageScrollable>{children}</PageScrollable>
      </div>
    </PageContainer>
  )
}

export function PageContainer(
  props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
) {
  return <div {...props} className={styles.container.mergeProps(props)()} />
}
