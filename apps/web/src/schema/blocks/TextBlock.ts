import alinea from 'alinea'
import {ChapterLinkBlock} from './ChapterLinkBlock'
import {CodeBlock} from './CodeBlock'
import {CodeVariantsBlock} from './CodeVariantsBlock'
import {ExampleBlock} from './ExampleBlock'
import {ImageBlock} from './ImageBlock'
import {NoticeBlock} from './NoticeBlock'

export const TextBlock = alinea.type('Body text', {
  text: alinea.richText('Text', {
    schema: alinea.schema({
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock
    }),
    inline: true
  })
})
