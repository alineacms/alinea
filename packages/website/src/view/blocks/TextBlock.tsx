import {fromModule} from '@alineacms/ui'
import {RichText} from '../layout/RichText'
import {CodeBlock} from './CodeBlock'
import {ImageBlock} from './ImageBlock'
import css from './TextBlock.module.scss'
import {TextBlockProps} from './TextBlock.query'

const styles = fromModule(css)

export function TextBlock({text}: TextBlockProps) {
  return (
    <div className={styles.root()}>
      <RichText doc={text} view={{CodeBlock, ImageBlock}} />
    </div>
  )
}
