import {fromModule, Typo} from '@alinea/ui'
import css from './CodeBlock.module.scss'
import {CodeBlockProps} from './CodeBlock.query'

const styles = fromModule(css)

export function CodeBlock({code}: CodeBlockProps) {
  return (
    <Typo.Monospace
      as="div"
      dangerouslySetInnerHTML={{__html: code}}
      className={styles.root()}
    />
  )
}
