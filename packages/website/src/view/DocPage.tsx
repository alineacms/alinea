import {Doc} from '.alinea/web'
import {Typo} from '@alinea/ui'
import {BlocksView} from './blocks/Blocks'
import {Container} from './layout/Container'

type CodeBlockProps = {
  code: string
}

function CodeBlock({code}: CodeBlockProps) {
  return <Typo.Monospace>{code}</Typo.Monospace>
}

export function DocPage({title, blocks}: Doc) {
  return (
    <Container>
      <BlocksView blocks={blocks} />
    </Container>
  )
}
