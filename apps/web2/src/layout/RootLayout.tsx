'use client'

import {useLocalStorage} from 'alinea/ui/hook/UseLocalStorage'
import {fromModule} from 'alinea/ui/util/Styler'
import {PropsWithChildren, useEffect} from 'react'
import {Footer, FooterProps} from './Footer'
import {Header, HeaderProps} from './Header.tsx_'
import css from './RootLayout.module.scss'

const styles = fromModule(css)

export type LayoutTheme = 'system' | 'dark' | 'light'

export interface RootLayoutProps {
  header: HeaderProps
  footer: FooterProps
  isHome: boolean
}

export function RootLayout({
  children,
  isHome,
  header,
  footer
}: PropsWithChildren<RootLayoutProps>) {
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
