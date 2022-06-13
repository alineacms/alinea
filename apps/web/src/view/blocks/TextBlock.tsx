import {fromModule} from '@alinea/ui'
import {Fragment} from 'react'
import {WebText} from '../layout/WebText'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'
import css from './TextBlock.module.scss'
import {TextBlockSchema} from './TextBlock.schema'

const styles = fromModule(css)

export function TextBlock({text, container}: TextBlockSchema) {
  const Wrapper = container || Fragment

  return (
    <div className={styles.root()}>
      <Wrapper>
        <WebText
          doc={text}
          CodeBlock={CodeBlock}
          CodeVariantsBlock={CodeVariantsBlock}
          ImageBlock={ImageBlock}
          NoticeBlock={NoticeBlock}
          ChapterLinkBlock={ChapterLinkBlock}
        />
      </Wrapper>
    </div>
  )
}
