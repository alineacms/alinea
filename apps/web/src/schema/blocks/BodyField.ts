import {Config, Field} from 'alinea'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ExampleBlock} from './ExampleBlock'
import {FrameworkBlock} from './FrameworkBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'

export function bodyField() {
  return Field.richText('Body', {
    searchable: true,
    schema: {
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock,
      FrameworkBlock
    }
  })
}

export const BodyBlock = Config.type('Body text', {
  fields: {
    body: bodyField()
  }
})
