import {Doc} from '../schema'
import {Container} from './layout/Container'
import {RichText} from './layout/RichText'

export function DocPage({body}: Doc) {
  return (
    <Container>
      <RichText {...body} />
    </Container>
  )
}
