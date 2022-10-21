import {Page} from '@alinea/content'
import {fromModule} from '@alinea/ui'
import {ComponentType, Fragment} from 'react'
import {WebText} from '../layout/WebText'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ExampleBlock} from './ExampleBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'
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
