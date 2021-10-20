import {Typo} from '@alinea/ui'
import Link from 'next/link'
import {Container} from './Container'

export function Footer() {
  return (
    <footer>
      <Container>
        <Link href="/admin">
          <Typo.Link>Go to admin panel</Typo.Link>
        </Link>
      </Container>
    </footer>
  )
}
