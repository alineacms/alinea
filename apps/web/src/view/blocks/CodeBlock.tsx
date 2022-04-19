import {fromModule, Typo} from '@alinea/ui'
import css from './CodeBlock.module.scss'
import {CodeBlockProps} from './CodeBlock.query'

const styles = fromModule(css)

export function CodeBlock({code, fileName}: CodeBlockProps) {
  return (
    <div className={styles.root()}>
      {fileName && <div className={styles.root.fileName()}>{fileName}</div>}
      <Typo.Monospace
        as="div"
        dangerouslySetInnerHTML={{__html: code}}
        className={styles.root.code()}
      />
    </div>
  )
}
