import styler from '@alinea/styler'
import Link from 'next/link'
import {cms} from '@/cms'
import {Home} from '@/schema/Home'
import {Logo} from './branding/Logo'
import css from './Footer.module.scss'

const styles = styler(css)

export async function Footer() {
  const sections = await cms.get({
    type: Home,
    select: Home.footer
  })
  return (
    <footer className={styles.root()}>
      <div className={styles.root.inner()}>
        <div className={styles.root.top()}>
          <div className={styles.root.about()}>
            <Link href="/" className={styles.root.logo()} title="Alinea CMS">
              <Logo className={styles.root.logo.mark()} />
            </Link>
            <p className={styles.root.description()}>
              The git-based CMS for Next.js. Open source and MIT licensed.
            </p>
          </div>
          <div className={styles.root.columns()}>
            {sections?.map(section => {
              return (
                <nav
                  key={section._id}
                  className={styles.root.column()}
                  aria-label={section.label}
                >
                  <span className={styles.root.column.title()}>
                    {section.label}
                  </span>
                  {section.links?.map(link => {
                    const target = 'target' in link ? link.target : undefined
                    return (
                      <Link
                        key={link._id}
                        href={link.href}
                        target={target || undefined}
                        rel={target === '_blank' ? 'noopener' : undefined}
                        className={styles.root.column.link()}
                      >
                        {link.fields.label || link.title}
                      </Link>
                    )
                  })}
                </nav>
              )
            })}
          </div>
        </div>
        <div className={styles.root.bottom()}>
          <span>MIT licensed</span>
          <span>Part of the Vercel Open Source Program</span>
        </div>
      </div>
    </footer>
  )
}
