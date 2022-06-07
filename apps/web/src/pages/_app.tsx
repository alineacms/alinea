import '@alinea/css'
import type {AppProps} from 'next/app'
import '../../src/global.scss'
import type {PageViewProps} from '../view/PageView.query'

export function App({Component, pageProps}: AppProps<PageViewProps>) {
  return <Component {...pageProps} />
}

export default App
