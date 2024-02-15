import {WebText} from '@/layout/WebText'
import {bodyField} from '@/schema/fields/BodyField'
import {Infer} from 'alinea'
import {fromModule} from 'alinea/ui'
import {ComponentType} from 'react'
import {ChapterLinkView} from './ChapterLinkView'
import {CodeBlockView} from './CodeBlockView'
import {CodeVariantsView} from './CodeVariantsView'
import {ExampleBlockView} from './ExampleBlockView'
import {FrameworkBlockView} from './FrameworkBlockView'
import {ImageBlockView} from './ImageBlockView'
import {NoticeView} from './NoticeView'
import css from './TextFieldView.module.scss'

const styles = fromModule(css)

export interface BodyViewProps {
  body: Infer<ReturnType<typeof bodyField>>
  container?: ComponentType
}

export function BodyFieldView({body}: BodyViewProps) {
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
