import styler from '@alinea/styler'
import type {DemoLayoutData} from '../demoData'
import {demoLocaleLabels, demoStrings} from '../demoStrings'
import {demoBrand} from '../demoWorkspace'
import css from './DemoFooter.module.scss'

const styles = styler(css)

export interface DemoFooterProps extends DemoLayoutData {}

export function DemoFooter({
  locale,
  homeUrl,
  nav,
  translations
}: DemoFooterProps) {
  const t = demoStrings(locale)
  return (
    <footer className={styles.DemoFooter()}>
      <div className={styles.DemoFooter.inner()}>
        <div className={styles.DemoFooter.brand()}>
          <a href={homeUrl} className={styles.DemoFooter.brand.logo()}>
            {demoBrand}
          </a>
          <p className={styles.DemoFooter.brand.tagline()}>{t.footerMade}</p>
        </div>
        <nav className={styles.DemoFooter.links()}>
          {nav.map(item => (
            <a
              key={item.id}
              href={item.url}
              className={styles.DemoFooter.link()}
            >
              {item.title}
            </a>
          ))}
        </nav>
        <nav className={styles.DemoFooter.links()} aria-label={t.languages}>
          {translations.map(translation => (
            <a
              key={translation.locale}
              href={translation.url}
              hrefLang={translation.locale}
              className={styles.DemoFooter.link()}
            >
              {demoLocaleLabels[translation.locale]}
            </a>
          ))}
        </nav>
      </div>
      <p className={styles.DemoFooter.note()}>{t.footerNote}</p>
    </footer>
  )
}
