import '@alinea/css'
import '@alinea/dashboard/global.css'
import type {AppProps} from 'next/app'

function MyApp({Component, pageProps}: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp
