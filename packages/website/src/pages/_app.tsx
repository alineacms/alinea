import '@alinea/css'
import '@alinea/dashboard/global.css'
import type {AppProps} from 'next/app'

export function App({Component, pageProps}: AppProps) {
  return <Component {...pageProps} />
}

export default App
