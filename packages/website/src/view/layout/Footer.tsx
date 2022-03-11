import {fromModule, Typo} from '@alinea/ui'
import Link from 'next/link'
import css from './Footer.module.scss'

const styles = fromModule(css)

export function Footer() {
  return (
    <footer className={styles.root()}>
      <Link href="/admin" passHref>
        <Typo.Link>Go to admin panel</Typo.Link>
      </Link>
    </footer>
  )
}
