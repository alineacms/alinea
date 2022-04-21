import {fromModule} from '@alinea/ui'
import {RichText} from '../layout/RichText'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ImageBlock} from './ImageBlock'
import css from './TextBlock.module.scss'
import {TextBlockProps} from './TextBlock.query'

const styles = fromModule(css)

export function TextBlock({text}: TextBlockProps) {
  return (
    <div className={styles.root()}>
      <RichText
        doc={text as any}
        view={{CodeBlock, CodeVariantsBlock, ImageBlock}}
      />
    </div>
  )
}
