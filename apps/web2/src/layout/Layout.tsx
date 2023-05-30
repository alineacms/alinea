'use client'

import {useLocalStorage} from 'alinea/ui/hook/UseLocalStorage'
import {fromModule} from 'alinea/ui/util/Styler'
import {HTMLAttributes, PropsWithChildren, ReactNode, useEffect} from 'react'
import {Footer, FooterProps} from './Footer'
import {Header, HeaderProps} from './Header'
import css from './Layout.module.scss'
import {NavSidebar} from './NavSidebar'

const styles = fromModule(css)

export interface LayoutProps {
  header: HeaderProps
  footer: FooterProps
  isHome: boolean
}

export function Layout({
  children,
  isHome,
  header,
  footer
}: PropsWithChildren<LayoutProps>) {
  const [theme, setTheme] = useLocalStorage<LayoutTheme>(
    '@alinea/web/theme',
    'system'
  )
  useEffect(() => {
    const name = theme.toLowerCase()
    document.documentElement.classList.add(`is-${name}`)
    return () => {
      document.documentElement.classList.remove(`is-${name}`)
    }
  }, [theme])
  return (
    <>
      <div className={styles.root()}>
        <Header {...header} transparent={isHome} />
        <div className={styles.root.content()}>{children}</div>
        <Footer footer={footer} theme={theme} setTheme={setTheme} />
      </div>
    </>
  )
}

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
