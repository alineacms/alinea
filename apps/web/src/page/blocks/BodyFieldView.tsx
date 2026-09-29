import {WebText} from '@/layout/WebText'
import {bodyField} from '@/schema/fields/BodyField'
import styler from '@alinea/styler'
import {Infer} from 'alinea'
import {ComponentType} from 'react'
import {ChapterLinkView} from './ChapterLinkView'
import {CodeBlockView} from './CodeBlockView'
import {CodeVariantsView} from './CodeVariantsView'
import {ComponentCatalogView} from './ComponentCatalogView'
import {ComponentExampleView} from './ComponentExampleView'
import {ComponentPropsView} from './ComponentPropsView'
import {CopyPromptView} from './CopyPromptView'
import {ExampleBlockView} from './ExampleBlockView'
import {FieldCatalogView} from './FieldCatalogView'
import {ImageBlockView} from './ImageBlockView'
import {NoticeView} from './NoticeView'
import css from './TextFieldView.module.scss'

const styles = styler(css)

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
      CopyPromptBlock={CopyPromptView}
      FieldCatalogBlock={FieldCatalogView}
      ComponentCatalogBlock={ComponentCatalogView}
      ComponentExampleBlock={ComponentExampleView}
      ComponentPropsBlock={ComponentPropsView}
    />
  )
}
