import {Config, Field} from 'alinea'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ExampleBlock} from './ExampleBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'

export const textField = () =>
  Field.richText('Body', {
    schema: {
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock
    },
    searchable: true
  })

export const TextBlock = Config.type('Body text', {
  fields: {text: textField()}
})
