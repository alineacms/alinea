import alinea from 'alinea'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ExampleBlock} from './ExampleBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'

export const textField = () =>
  alinea.richText('Body', {
    schema: alinea.schema({
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock
    }),
    inline: true,
    searchable: true
  })

export const TextBlock = alinea.type('Body text', {
  text: textField()
})
