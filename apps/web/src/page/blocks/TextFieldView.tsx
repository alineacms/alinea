import {WebText} from '@/layout/WebText'
import {textField} from '@/schema/fields/TextField'
import {Infer} from 'alinea'
import {fromModule} from 'alinea/ui'
import {ComponentType} from 'react'
import {ChapterLinkView} from './ChapterLinkView'
import {CodeBlockView} from './CodeBlockView'
import {CodeVariantsView} from './CodeVariantsView'
import {ExampleBlockView} from './ExampleBlockView'
import {ImageBlockView} from './ImageBlockView'
import {NoticeView} from './NoticeView'
import css from './TextFieldView.module.scss'

const styles = fromModule(css)

export interface TextBlockViewProps {
  text: Infer<ReturnType<typeof textField>>
  container?: ComponentType
}

export function TextFieldView({text}: TextBlockViewProps) {
  return (
    <WebText
      doc={text}
      CodeBlock={CodeBlockView}
      CodeVariantsBlock={CodeVariantsView}
      ExampleBlock={ExampleBlockView}
      ChapterLinkBlock={ChapterLinkView}
      NoticeBlock={NoticeView}
      ImageBlock={ImageBlockView}
    />
  )
}
