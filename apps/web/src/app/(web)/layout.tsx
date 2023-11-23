import {cms} from '@/cms'
import {fromModule} from 'alinea/ui'
import {PropsWithChildren} from 'react'
import {Footer} from '../../layout/Footer'
import {Header} from '../../layout/Header'
import '../../styles/global.scss'
import css from './layout.module.scss'

const styles = fromModule(css)

export const metadata = {
  title: 'Alinea'
}

export default async function Layout({children}: PropsWithChildren) {
  return (
    <div className={styles.layout()}>
      <Header />
      <div className={styles.layout.content()}>{children}</div>
      <Footer />
      <cms.previews />
    </div>
  )
}
