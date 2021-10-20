import '@alinea/css'
import '@alinea/dashboard/global.css'
import type {AppProps} from 'next/app'
import {Layout} from '../view/layout/Layout'

export function App({Component, pageProps}: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}

export default App
