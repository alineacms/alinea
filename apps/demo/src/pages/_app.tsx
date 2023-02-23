import '@alinea/css'
import {useNextPreview} from 'alinea/preview/next'
import type {AppProps} from 'next/app'
import Head from 'next/head'
import Script from 'next/script'
import '../styles/global.scss'

export function App({Component, pageProps}: AppProps) {
  useNextPreview()
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/favicon.png" />
      </Head>
      <Script
        src="https://cdn.counter.dev/script.js"
        data-id="add5d16a-04cf-484e-9f22-4d648ee47a95"
        data-utcoffset="2"
      />
      <Component {...pageProps} />
    </>
  )
}

export default App
