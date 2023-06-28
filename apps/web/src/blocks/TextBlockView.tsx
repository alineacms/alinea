import {Infer} from 'alinea'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {WebText} from '../layout/WebText'
import {TextBlock} from '../schema/blocks/TextBlock'
import {ChapterLinkView} from './ChapterLinkView'
import {CodeBlockView} from './CodeBlockView'
import {CodeVariantsView} from './CodeVariantsView'
import {ExampleBlockView} from './ExampleBlockView'
import {NoticeView} from './NoticeView'
import css from './TextBlockView.module.scss'

const styles = fromModule(css)

export interface TextBlockViewProps extends Infer<typeof TextBlock> {
  container?: ComponentType
}

export function TextBlockView({text, container}: TextBlockViewProps) {
  const Wrapper = container || Fragment
  return (
    <div className={styles.root()}>
      <Wrapper>
        <WebText
          doc={text}
          CodeBlock={CodeBlockView}
          CodeVariantsBlock={CodeVariantsView}
          ExampleBlock={ExampleBlockView}
          ChapterLinkBlock={ChapterLinkView}
          NoticeBlock={NoticeView}
        />
      </Wrapper>
    </div>
  )
}
