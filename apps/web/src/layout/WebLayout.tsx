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
  /** Force a color theme, by default the system preference is followed */
  theme?: 'light' | 'dark' | null
  /** Text shown next to the logo in the header */
  badge?: string | null
}

export default async function WebLayout({
  children,
  footer = true,
  theme,
  badge
}: PropsWithChildren<WebLayoutProps>) {
  // The global theme-dark class applies the dark palette, see global.scss
  const themeClass = theme === 'dark' ? 'theme-dark' : undefined
  return (
    <div className={styles.layout(styler.merge({className: themeClass}))}>
      <Header badge={badge || undefined} />
      <div className={styles.layout.content()}>{children}</div>
      {footer && <Footer />}
      <cms.previews widget />
    </div>
  )
}
