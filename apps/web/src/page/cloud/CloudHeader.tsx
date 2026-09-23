import styler from '@alinea/styler'
import Link from 'next/link'
import {CloudBrand} from './CloudBrand'
import {CloudButton} from './CloudButton'
import css from './CloudHeader.module.scss'
import {cloudGetStartedUrl, cloudLogInUrl} from './CloudLinks'

const styles = styler(css)

export function CloudHeader() {
  return (
    <header className={styles.root()}>
      <CloudBrand />
      <nav className={styles.root.links()} aria-label="Alinea Cloud">
        <a href="#features" className={styles.root.link()}>
          Features
        </a>
        <a href="#how-it-works" className={styles.root.link()}>
          How it works
        </a>
        <a href="#faq" className={styles.root.link()}>
          FAQ
        </a>
        <Link href="/docs" className={styles.root.link()}>
          Docs
        </Link>
      </nav>
      <div className={styles.root.actions()}>
        <a href={cloudLogInUrl} className={styles.root.login()}>
          Log in
        </a>
        <CloudButton href={cloudGetStartedUrl} size="small">
          Get started
        </CloudButton>
      </div>
    </header>
  )
}
