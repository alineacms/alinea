import {Doc} from '.alinea'
import {Typo} from '@alinea/ui'
import {Container} from './layout/Container'
import {RichText} from './layout/RichText'

type CodeBlockProps = {
  code: string
}

function CodeBlock({code}: CodeBlockProps) {
  return <Typo.Monospace>{code}</Typo.Monospace>
}

export function DocPage({body}: Doc) {
  return (
    <Container>
      <RichText doc={body} view={{CodeBlock}} />
    </Container>
  )
}
