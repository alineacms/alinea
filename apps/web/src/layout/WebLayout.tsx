import {cms} from '@/cms'
import '@/global.scss'
import {Footer} from '@/layout/Footer'
import {Header} from '@/layout/Header'
import {fromModule} from 'alinea/ui'
import {PropsWithChildren} from 'react'
import css from './WebLayout.module.scss'

const styles = fromModule(css)

export const metadata = {
  title: 'Alinea'
}

export const viewport = {
  themeColor: '#4a65e8'
}

export interface WebLayoutProps {
  footer?: boolean
}

export default async function WebLayout({
  children,
  footer = true
}: PropsWithChildren<WebLayoutProps>) {
  return (
    <div className={styles.layout()}>
      <Header />
      <div className={styles.layout.content()}>{children}</div>
      {footer && <Footer />}
      <cms.previews />
    </div>
  )
}
