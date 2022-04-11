import {fromModule, Typo} from '@alinea/ui'
import css from './CodeBlock.module.scss'
import {CodeBlockSchema} from './CodeBlock.schema'

const styles = fromModule(css)

export function CodeBlock({code}: CodeBlockSchema) {
  return (
    <div className={styles.root()}>
      <Typo.Monospace>{code}</Typo.Monospace>
    </div>
  )
}
