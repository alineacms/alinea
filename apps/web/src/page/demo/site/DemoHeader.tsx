import styler from '@alinea/styler'
import type {DemoLayoutData} from '../demoData'
import {demoLocaleLabels, demoStrings} from '../demoStrings'
import {demoBrand} from '../demoWorkspace'
import css from './DemoHeader.module.scss'
import {DemoHeaderNav} from './DemoHeaderNav'

const styles = styler(css)

export interface DemoHeaderProps extends DemoLayoutData {}

export function DemoHeader({
  locale,
  homeUrl,
  nav,
  translations
}: DemoHeaderProps) {
  const t = demoStrings(locale)
  const [first, ...rest] = demoBrand.split(' & ')
  return (
    <header className={styles.DemoHeader()}>
      <div className={styles.DemoHeader.inner()}>
        <a href={homeUrl} className={styles.DemoHeader.logo()}>
          {rest.length > 0 ? (
            <>
              {first}
              <span className={styles.DemoHeader.logo.amp()}> & </span>
              {rest.join(' & ')}
            </>
          ) : (
            demoBrand
          )}
        </a>
        <DemoHeaderNav className={styles.DemoHeader.nav()} label={t.menu}>
          {nav.map(item => (
            <a
              key={item.id}
              href={item.url}
              className={styles.DemoHeader.nav.link({active: item.active})}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.title}
            </a>
          ))}
        </DemoHeaderNav>
        <nav className={styles.DemoHeader.locales()} aria-label={t.languages}>
          {translations.map(translation => (
            <a
              key={translation.locale}
              href={translation.url}
              hrefLang={translation.locale}
              title={demoLocaleLabels[translation.locale]}
              className={styles.DemoHeader.locales.link({
                active: translation.active
              })}
            >
              {translation.locale}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
