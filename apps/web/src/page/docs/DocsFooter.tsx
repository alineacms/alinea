import styler from '@alinea/styler'
import Link from 'next/link'
import {DocsIconArrowLeft, DocsIconArrowRight} from './DocsIcons'
import css from './DocsFooter.module.scss'

const styles = styler(css)

interface DocsFooterPage {
  url: string
  title: string
}

export interface DocsFooterProps {
  prev?: DocsFooterPage
  next?: DocsFooterPage
}

/** Ends every docs page: links to the neighbouring pages in sidebar order */
export function DocsFooter({prev, next}: DocsFooterProps) {
  return (
    <footer className={styles.root()}>
      {(prev || next) && (
        <nav aria-label="Pagination" className={styles.root.pager()}>
          {prev && (
            <Link href={prev.url} rel="prev" className={styles.root.link()}>
              <span className={styles.root.link.label()}>
                <DocsIconArrowLeft className={styles.root.link.icon()} />
                Previous
              </span>
              <span className={styles.root.link.title()}>{prev.title}</span>
            </Link>
          )}
          {next && (
            <Link
              href={next.url}
              rel="next"
              className={styles.root.link('next')}
            >
              <span className={styles.root.link.label()}>
                Next
                <DocsIconArrowRight className={styles.root.link.icon()} />
              </span>
              <span className={styles.root.link.title()}>{next.title}</span>
            </Link>
          )}
        </nav>
      )}
      <p className={styles.root.legal()}>
        © {new Date().getFullYear()} Alinea · MIT licensed · Part of the Vercel
        Open Source Program
      </p>
    </footer>
  )
}
