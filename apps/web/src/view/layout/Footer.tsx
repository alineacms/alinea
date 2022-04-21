import {fromModule} from '@alinea/ui'
import Link from 'next/link'
import css from './Footer.module.scss'

const styles = fromModule(css)

export function Footer() {
  return (
    <footer className={styles.root()}>
      {false && (
        <Link href="/admin">
          <a className={styles.root.link()}>Go to admin panel</a>
        </Link>
      )}
    </footer>
  )
}
