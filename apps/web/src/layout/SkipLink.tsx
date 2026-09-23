'use client'

import styler from '@alinea/styler'
import {usePathname} from 'next/navigation'
import {isDocsPath} from '@/utils/docs'
import css from './SkipLink.module.scss'

const styles = styler(css)

/** First tab stop of the page, jumps past the header (and docs sidebar) */
export function SkipLink() {
  const pathname = usePathname()
  return (
    <a
      href={isDocsPath(pathname) ? '#docs-content' : '#content'}
      className={styles.root()}
    >
      Skip to content
    </a>
  )
}
