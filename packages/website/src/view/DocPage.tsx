import {Doc} from '.alinea/web'
import {Blocks} from './blocks/Blocks'
import {Container} from './layout/Container'

export function DocPage({title, blocks}: Doc) {
  return (
    <Container>
      <Blocks blocks={blocks} />
    </Container>
  )
}
