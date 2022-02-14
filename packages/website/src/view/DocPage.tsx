import {Doc} from '.alinea/web'
import {Typo} from '@alinea/ui'
import {Container} from './layout/Container'
import {RichText} from './layout/RichText'

type CodeBlockProps = {
  code: string
}

function CodeBlock({code}: CodeBlockProps) {
  return <Typo.Monospace>{code}</Typo.Monospace>
}

export function DocPage({title, body}: Doc) {
  return (
    <Container>
      <Typo.H1>{title}</Typo.H1>
      <RichText doc={body} view={{CodeBlock}} />
    </Container>
  )
}
