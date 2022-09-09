import {fromModule} from '@alinea/ui'
import {useLocalStorage} from '@alinea/ui/hook/UseLocalStorage'
import Head from 'next/head'
import {HTMLAttributes, PropsWithChildren, useEffect} from 'react'
import {FavIcon} from './branding/FavIcon'
import {Footer} from './Footer'
import {Header} from './Header'
import css from './Layout.module.scss'
import {LayoutProps} from './Layout.server'

const styles = fromModule(css)

export function Layout({
  meta,
  children,
  is,
  header,
  footer
}: PropsWithChildren<LayoutProps>) {
  const [theme, setTheme] = useLocalStorage<Layout.Theme>(
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

export namespace Layout {
  export type Theme = 'system' | 'dark' | 'light'

  export function Content({children}: PropsWithChildren<{}>) {
    return <div className={styles.content()}>{children}</div>
  }

  export function Scrollable({children}: PropsWithChildren<{}>) {
    return (
      <div className={styles.scrollable()}>
        <div className={styles.scrollable.inner()}>{children}</div>
      </div>
    )
  }

  export function Container(
    props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>
  ) {
    return <div {...props} className={styles.container.mergeProps(props)()} />
  }
}
