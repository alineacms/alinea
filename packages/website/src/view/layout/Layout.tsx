import {fromModule} from '@alineacms/ui'
import Head from 'next/head'
import {PropsWithChildren} from 'react'
import {FavIcon} from './branding/FavIcon'
import {Footer} from './Footer'
import {Header} from './Header'
import css from './Layout.module.scss'
import {LayoutProps} from './Layout.query'

const styles = fromModule(css)

export function Layout({
  meta,
  children,
  header
}: PropsWithChildren<LayoutProps>) {
  return (
    <>
      <FavIcon color="#EF437C" />
      <Head>
        <title>{meta.title}</title>
        <style key="f-size">
          {`
          @media (max-width: 440px) {html {font-size: calc(4.4444vw + .00012px)}}
          @media (min-width: 1024px) {html {font-size: calc(0.2564102564vw + 0.93269rem)}}
        `}
        </style>
      </Head>
      <div className={styles.root()}>
        <Header {...header} />
        <div className={styles.root.content()}>{children}</div>
        <Footer />
      </div>
    </>
  )
}
