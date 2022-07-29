import {useNextPreview} from '@alinea/preview/next'
import type {AppProps} from 'next/app'

export function App({Component, pageProps}: AppProps) {
  useNextPreview()
  return <Component {...pageProps} />
}

export default App
