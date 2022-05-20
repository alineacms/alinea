import {fromModule, Typo} from '@alinea/ui'
import css from './CodeBlock.module.scss'
import {CodeBlockSchema} from './CodeBlock.schema'

const styles = fromModule(css)

export function CodeBlock({code, compact, fileName}: CodeBlockSchema) {
  return (
    <div className={styles.root({compact})}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <Typo.Monospace
        as="div"
        dangerouslySetInnerHTML={{__html: code}}
        className={styles.root.code()}
      />
    </div>
  )
}
