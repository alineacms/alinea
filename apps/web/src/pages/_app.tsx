import '@alinea/css'
import '@alinea/web/src/styles/global.scss'
import type {AppProps} from 'next/app'
import Script from 'next/script'
import type {PageViewProps} from '../view/PageView.server'
import {SEO} from '../view/SEO'

export function App({Component, pageProps}: AppProps<PageViewProps>) {
  return (
    <>
      <SEO title={pageProps.entry?.title} />
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
