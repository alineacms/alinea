import {WebText} from '@/layout/WebText'
import {BodyBlock} from '@/schema/blocks/BodyField'
import alinea from 'alinea'
import {fromModule} from 'alinea/ui'
import {ComponentType, Fragment} from 'react'
import {ChapterLinkView} from './ChapterLinkView'
import {CodeBlockView} from './CodeBlockView'
import {CodeVariantsView} from './CodeVariantsView'
import {ExampleBlockView} from './ExampleBlockView'
import {FrameworkBlockView} from './FrameworkBlockView'
import {ImageBlockView} from './ImageBlockView'
import {NoticeView} from './NoticeView'
import css from './TextBlockView.module.scss'

const styles = fromModule(css)

export interface BodyViewProps extends alinea.infer<typeof BodyBlock> {
  container?: ComponentType
}

export function BodyBlockView({body, container}: BodyViewProps) {
  const Wrapper = container || Fragment
  return (
    <div className={styles.root()}>
      <Wrapper>
        <BodyView body={body} />
      </Wrapper>
    </div>
  )
}

export function BodyView({body}: BodyViewProps) {
  return (
    <WebText
      doc={body}
      CodeBlock={CodeBlockView}
      CodeVariantsBlock={CodeVariantsView}
      ExampleBlock={ExampleBlockView}
      ChapterLinkBlock={ChapterLinkView}
      NoticeBlock={NoticeView}
      ImageBlock={ImageBlockView}
      FrameworkBlock={FrameworkBlockView}
    />
  )
}
