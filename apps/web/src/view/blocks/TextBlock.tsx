import {fromModule} from '@alinea/ui'
import {RichText} from '../layout/RichText'
import {CodeBlock} from './CodeBlock'
import {ImageBlock} from './ImageBlock'
import css from './TextBlock.module.scss'
import {TextBlockProps} from './TextBlock.query'
import {TypesBlock} from './TypesBlock'

const styles = fromModule(css)

export function TextBlock({text}: TextBlockProps) {
  return (
    <div className={styles.root()}>
      <RichText doc={text as any} view={{CodeBlock, ImageBlock, TypesBlock}} />
    </div>
  )
}
