import styler from '@alinea/styler'
import Link from 'next/link'
import {Fragment} from 'react'
import css from './Breadcrumbs.module.scss'

const styles = styler(css)

interface BreadcrumbsParent {
  id: string
  title: string
  url?: string
}

export interface BreadcrumbsProps {
  parents: Array<BreadcrumbsParent>
  /** Title of the current page, rendered after the parents */
  current?: string
  flat?: boolean
}

export function Breadcrumbs({parents, current, flat}: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={styles.root({flat})}>
      {parents.map((parent, i) => {
        const isLast = !current && i === parents.length - 1
        return (
          <Fragment key={parent.id}>
            {parent.url ? (
              <Link href={parent.url} className={styles.root.link()}>
                {parent.title}
              </Link>
            ) : (
              <span className={styles.root.item()}>{parent.title}</span>
            )}
            {!isLast && (
              <span className={styles.root.separator()} aria-hidden="true">
                /
              </span>
            )}
          </Fragment>
        )
      })}
      {current && (
        <span className={styles.root.current()} aria-current="page">
          {current}
        </span>
      )}
    </nav>
  )
}
