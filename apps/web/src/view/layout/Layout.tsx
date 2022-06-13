import {fromModule} from '@alinea/ui'
import Head from 'next/head'
import {useRouter} from 'next/router'
import {HTMLAttributes, PropsWithChildren, useEffect, useRef} from 'react'
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
        <Footer footer={footer} />
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
