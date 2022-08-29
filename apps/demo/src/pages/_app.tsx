import '@alinea/css'
import {useNextPreview} from '@alinea/preview/next'
import type {AppProps} from 'next/app'
import Head from 'next/head'
import '../styles/global.scss'

export function App({Component, pageProps}: AppProps) {
  useNextPreview()
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/favicon.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default App
