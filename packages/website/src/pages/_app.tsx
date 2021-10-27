import '@alinea/css'
import '@alinea/css/global.css'
import type {AppProps} from 'next/app'

export function App({Component, pageProps}: AppProps) {
  return <Component {...pageProps} />
}

export default App
