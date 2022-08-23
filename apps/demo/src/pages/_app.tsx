import {useNextPreview} from '@alinea/preview/next'
import type {AppProps} from 'next/app'
import Head from 'next/head'
import '../styles/global.scss'
import {DemoLayout} from '../view/layout/DemoLayout'

export function App({Component, pageProps}: AppProps) {
  useNextPreview()
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/favicon.png" />
      </Head>
      <DemoLayout>
        <Component {...pageProps} />
      </DemoLayout>
    </>
  )
}

export default App
