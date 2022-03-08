import {Blocks} from './blocks/Blocks'
import {DocPageProps} from './DocPage.query'
import {Container} from './layout/Container'

export function DocPage({title, blocks, menu}: DocPageProps) {
  return (
    <Container>
      <Blocks blocks={blocks} />
    </Container>
  )
}
