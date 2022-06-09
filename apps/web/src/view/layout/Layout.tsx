import {fromModule} from '@alinea/ui'
import Head from 'next/head'
import {useRouter} from 'next/router'
import {PropsWithChildren, useEffect, useRef} from 'react'
import {FavIcon} from './branding/FavIcon'
import {Header} from './Header'
import css from './Layout.module.scss'
import {LayoutProps} from './Layout.server'

const styles = fromModule(css)

export function Layout({
  meta,
  children,
  is,
  header
}: PropsWithChildren<LayoutProps>) {
  return (
    <>
      <FavIcon color="#4a63e7" />
      <Head>
        <title>{meta.title}</title>
        <style>
          {`
            @media (max-width: 440px) {html {font-size: calc(4.4444vw + .00012px)}}
            @media (min-width: 1024px) {html {font-size: calc(0.25vw + 0.85rem)}}
          `}
        </style>
      </Head>
      <div className={styles.root(is)}>
        <Header negative={is.home} {...header} />
        <div className={styles.root.content()}>{children}</div>
        {/*<Footer />*/}
      </div>
    </>
  )
}

export namespace Layout {
  export function Content({children}: PropsWithChildren<{}>) {
    return <div className={styles.content()}>{children}</div>
  }

  export function Scrollable({children}: PropsWithChildren<{}>) {
    const router = useRouter()
    const ref = useRef<HTMLDivElement>(null)
    const path = JSON.stringify(router.query)
    useEffect(() => {
      ref.current?.scrollTo(0, 0)
    }, [path])
    return (
      <div ref={ref} className={styles.scrollable()}>
        {children}
      </div>
    )
  }
}
