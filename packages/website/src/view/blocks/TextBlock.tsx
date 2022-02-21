import {fromModule} from '@alinea/ui'
import {RichText} from '../layout/RichText'
import {CodeBlock} from './CodeBlock'
import css from './TextBlock.module.scss'
import {TextBlockSchema} from './TextBlock.schema'

const styles = fromModule(css)

export function TextBlock({text}: TextBlockSchema) {
  return (
    <div className={styles.root()}>
      <RichText doc={text} view={{CodeBlock: CodeBlock}} />
    </div>
  )
}
