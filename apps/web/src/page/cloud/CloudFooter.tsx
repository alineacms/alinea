import styler from '@alinea/styler'
import Link from 'next/link'
import {CloudBrand} from './CloudBrand'
import css from './CloudFooter.module.scss'
import {cloudLogInUrl, cloudPrivacyUrl, cloudTermsUrl} from './CloudLinks'

const styles = styler(css)

export function CloudFooter() {
  return (
    <footer className={styles.root()}>
      <div className={styles.root.top()}>
        <div className={styles.root.about()}>
          <CloudBrand size="small" />
          <p className={styles.root.tagline()}>
            The hosted backend for Alinea, the git-based CMS for Next.js.
          </p>
        </div>
        <div className={styles.root.columns()}>
          <nav className={styles.root.column()} aria-label="Cloud">
            <span className={styles.root.heading()}>Cloud</span>
            <a href="#features" className={styles.root.link()}>
              Features
            </a>
            <a href="#faq" className={styles.root.link()}>
              FAQ
            </a>
            <a href={cloudLogInUrl} className={styles.root.link()}>
              Log in
            </a>
          </nav>
          <nav className={styles.root.column()} aria-label="Alinea">
            <span className={styles.root.heading()}>Alinea</span>
            <Link href="/" className={styles.root.link()}>
              Homepage
            </Link>
            <Link href="/docs" className={styles.root.link()}>
              Docs
            </Link>
            <Link href="/changelog" className={styles.root.link()}>
              Changelog
            </Link>
            <a
              href="https://github.com/alineacms/alinea"
              className={styles.root.link()}
            >
              GitHub
            </a>
          </nav>
          <nav className={styles.root.column()} aria-label="Legal">
            <span className={styles.root.heading()}>Legal</span>
            <a href={cloudPrivacyUrl} className={styles.root.link()}>
              Privacy policy
            </a>
            <a href={cloudTermsUrl} className={styles.root.link()}>
              Terms of service
            </a>
          </nav>
        </div>
      </div>
      <div className={styles.root.bottom()}>
        <span>Alinea is MIT licensed</span>
        <span>Part of the Vercel Open Source Program</span>
      </div>
    </footer>
  )
}
