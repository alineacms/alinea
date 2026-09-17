import {cms} from '@/cms'
import '@/global.scss'
import styler from '@alinea/styler'
import type {Metadata, Viewport} from 'next'
import type {PropsWithChildren} from 'react'
import {Footer} from '@/layout/Footer'
import {Header} from '@/layout/Header'
import css from './WebLayout.module.scss'

const styles = styler(css)

export const metadata: Metadata = {
  title: 'Alinea CMS'
}

export const viewport: Viewport = {
  themeColor: '#3f61e8'
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
      <cms.previews widget />
    </div>
  )
}
