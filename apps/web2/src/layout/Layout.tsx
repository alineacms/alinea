'use client'

import {useLocalStorage} from 'alinea/ui/hook/UseLocalStorage'
import {fromModule} from 'alinea/ui/util/Styler'
import Head from 'next/head'
import {HTMLAttributes, PropsWithChildren, ReactNode, useEffect} from 'react'
import {Footer} from './Footer'
import {Header} from './Header'
import css from './Layout.module.scss'
import {NavSidebar} from './NavSidebar'
import {FavIcon} from './branding/FavIcon'

const styles = fromModule(css)

export function Layout({meta, children, is, header, footer}) {
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
      <FavIcon color="#4a65e8" />
      <Head>
        <title>{meta.title}</title>
        <meta name="theme-color" content="#4a65e8" />
        <style>
          {`
            @media (max-width: 440px) {html {font-size: calc(4.4444vw + .00012px)}}
          `}
        </style>
      </Head>
      <div className={styles.root(is)}>
        <Header transparent={is.home} {...header} />
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
