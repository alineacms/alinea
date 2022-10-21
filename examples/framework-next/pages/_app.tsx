import {useNextPreview} from '@alinea/preview/next'
import {AppProps} from 'next/app'
import '../styles/index.css'

export default function MyApp({Component, pageProps}: AppProps) {
  // If we're in an iframe listen to content changes and reload props
  useNextPreview()
  return <Component {...pageProps} />
}
