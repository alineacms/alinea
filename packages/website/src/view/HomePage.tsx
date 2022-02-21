import {HStack, px, Typo} from '@alinea/ui'
import {HomePageSchema} from './HomePage.schema'
import {Container} from './layout/Container'

export function HomePage({headline, byline}: HomePageSchema) {
  return (
    <Container>
      <header style={{padding: `${px(25)} 0`}}>
        <HStack style={{height: '200px'}} center justify="center" gap={10}>
          <div>
            <Typo.H1 flat>{headline}</Typo.H1>
            <Typo.P>{byline}</Typo.P>
          </div>
        </HStack>
      </header>
    </Container>
  )
}
