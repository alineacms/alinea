import '@alinea/css'
import '@alinea/css/global.css'
import type {AppProps} from 'next/app'
import Head from 'next/head'
import type {PageViewProps} from '../view/PageView.query'

export function App({Component, pageProps}: AppProps<PageViewProps>) {
  const props: Partial<PageViewProps> = pageProps
  return (
    <>
      <Head>
        <title>{props.meta?.title}</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default App
