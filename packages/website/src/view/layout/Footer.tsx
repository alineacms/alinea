import Link from 'next/link'
import {Container} from './Container'

export function Footer() {
  return (
    <footer>
      <Container>
        <Link href="/admin">Go to admin panel</Link>
      </Container>
    </footer>
  )
}
