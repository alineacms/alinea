import {cms} from '@/cms'
import {Entry} from 'alinea/core'
import type {ReactNode} from 'react'
import styles from './DemoPage.module.css'

export interface DemoPageProps {
  title: string
  description: string
  rendering: string
  runtime: 'node' | 'edge'
  children?: ReactNode
}

const navigation = [
  {href: '/', label: 'Index'},
  {href: '/demo/static', label: 'Static'},
  {href: '/demo/dynamic', label: 'Dynamic'},
  {href: '/demo/edge', label: 'Edge'}
]

export interface DemoLink {
  href: string
  label: string
  description: string
}

export interface DemoLinksProps {
  title: string
  links: Array<DemoLink>
}

/** A titled list of links, styled like the page list below it. */
export function DemoLinks(props: DemoLinksProps) {
  return (
    <section className={styles.DemoPageSection}>
      <h2 className={styles.DemoPageSectionTitle}>{props.title}</h2>
      <ul className={styles.DemoPagePages}>
        {props.links.map(link => (
          <li className={styles.DemoPagePagesItem} key={link.href}>
            <a className={styles.DemoPagePagesLink} href={link.href}>
              {link.label}
            </a>
            <span className={styles.DemoPagePagesType}>{link.description}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function DemoPage(props: DemoPageProps) {
  const started = performance.now()
  const [status, pages] = await Promise.all([
    cms.status(),
    cms.find({
      root: cms.workspaces.primary.pages,
      locale: 'en',
      select: {title: Entry.title, url: Entry.url, type: Entry.type}
    })
  ])
  const queryDuration = performance.now() - started
  const renderedAt = new Date().toISOString()
  const details = [
    {term: 'Rendering', value: props.rendering},
    {term: 'Runtime', value: props.runtime},
    {term: 'Rendered at', value: renderedAt},
    {
      term: 'Query time',
      value: `${queryDuration.toFixed(1)} ms (status and page list, including any sync)`
    },
    {term: 'Answered from', value: status.source},
    {term: 'Content sha', value: status.sha ?? 'unknown'},
    {
      term: 'Last synced',
      value: status.syncedAt
        ? status.syncedAt.toISOString()
        : 'never (build snapshot)'
    }
  ]
  return (
    <main className={styles.DemoPage}>
      <nav className={styles.DemoPageNav}>
        {navigation.map(item => (
          <a
            className={styles.DemoPageNavLink}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <header className={styles.DemoPageHeader}>
        <p className={styles.DemoPageEyebrow}>Alinea Next demo</p>
        <h1 className={styles.DemoPageTitle}>{props.title}</h1>
        <p className={styles.DemoPageDescription}>{props.description}</p>
      </header>
      {props.children}
      <section className={styles.DemoPageSection}>
        <h2 className={styles.DemoPageSectionTitle}>Render status</h2>
        <dl className={styles.DemoPageStatus}>
          {details.map(detail => (
            <div className={styles.DemoPageStatusRow} key={detail.term}>
              <dt className={styles.DemoPageStatusTerm}>{detail.term}</dt>
              <dd className={styles.DemoPageStatusValue}>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.DemoPageSection}>
        <h2 className={styles.DemoPageSectionTitle}>Pages ({pages.length})</h2>
        {pages.length === 0 ? (
          <p className={styles.DemoPageEmpty}>
            No pages were found in the primary workspace.
          </p>
        ) : (
          <ul className={styles.DemoPagePages}>
            {pages.map(page => (
              <li className={styles.DemoPagePagesItem} key={page.url}>
                <a className={styles.DemoPagePagesLink} href={page.url}>
                  {page.title}
                </a>
                <span className={styles.DemoPagePagesType}>{page.type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
