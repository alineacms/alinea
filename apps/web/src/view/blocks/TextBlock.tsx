import {fromModule} from '@alinea/ui'
import {RichText} from '../layout/RichText'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'
import css from './TextBlock.module.scss'
import {TextBlockSchema} from './TextBlock.schema'

const styles = fromModule(css)

export function TextBlock({text}: TextBlockSchema) {
  return (
    <div className={styles.root()}>
      <RichText
        doc={text}
        view={{
          CodeBlock,
          CodeVariantsBlock,
          ImageBlock,
          NoticeBlock,
          ChapterLinkBlock
        }}
      />
    </div>
  )
}
