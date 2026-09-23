import styler from '@alinea/styler'
import type {Viewport} from 'next'
import type {PropsWithChildren} from 'react'
import {cms} from '@/cms'
import {CloudFooter} from './CloudFooter'
import {CloudHeader} from './CloudHeader'
import css from './CloudLayout.module.scss'

const styles = styler(css)

export const viewport: Viewport = {
  themeColor: '#0d1030'
}

export default function CloudLayout({children}: PropsWithChildren) {
  return (
    <div className={styles.root()}>
      <CloudHeader />
      <main className={styles.root.content()}>{children}</main>
      <CloudFooter />
      <cms.previews widget />
    </div>
  )
}
