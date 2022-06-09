import '@alinea/css'
import '@alinea/web/src/styles/global.scss'
import type {AppProps} from 'next/app'
import type {PageViewProps} from '../view/PageView.server'

export function App({Component, pageProps}: AppProps<PageViewProps>) {
  return <Component {...pageProps} />
}

export default App
