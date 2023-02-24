import {Page} from 'alinea/content'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {WebText} from '../layout/WebText.js'
import {ChapterLinkBlock} from './ChapterLinkBlock.js'
import {CodeBlock} from './CodeBlock.js'
import {CodeVariantsBlock} from './CodeVariantsBlock.js'
import {ExampleBlock} from './ExampleBlock.js'
import {ImageBlock} from './ImageBlock.js'
import {NoticeBlock} from './NoticeBlock.js'
import css from './TextBlock.module.scss'

const styles = fromModule(css)

export interface TextBlockProps extends Page.TextBlock {
  container?: ComponentType
}

export function TextBlock({text, container}: TextBlockProps) {
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
          ExampleBlock={ExampleBlock}
        />
      </Wrapper>
    </div>
  )
}
