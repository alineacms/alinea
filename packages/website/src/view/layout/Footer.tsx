import {fromModule} from '@alinea/ui'
import Link from 'next/link'
import {Container} from './Container'
import css from './Footer.module.scss'

const styles = fromModule(css)

export function Footer() {
  return (
    <footer className={styles.root()}>
      <Container>
        <Link href="/admin">Go to admin panel</Link>
      </Container>
    </footer>
  )
}
