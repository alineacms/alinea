import {HStack, px, Typo} from '@alinea/ui'
import Link from 'next/link'
import {HomePageProps} from './HomePage.query'
import {Container} from './layout/Container'

export function HomePage({headline, byline, gettingStarted}: HomePageProps) {
  return (
    <Container>
      <header style={{padding: `${px(25)} 0`}}>
        <HStack style={{height: '200px'}} center justify="center" gap={10}>
          <div>
            <Typo.H1 flat>{headline}</Typo.H1>
            <Typo.P>{byline}</Typo.P>
            <Link href={gettingStarted.url} passHref>
              <Typo.Link>{gettingStarted.title}</Typo.Link>
            </Link>
          </div>
        </HStack>
      </header>
    </Container>
  )
}
