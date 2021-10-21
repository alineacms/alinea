import {Doc} from '../schema'
import {Container} from './layout/Container'

export function DocPage({title}: Doc) {
  return <Container>{title}</Container>
}
