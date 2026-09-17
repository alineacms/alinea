import {Field} from 'alinea'
import {ChapterLinkBlock} from '../blocks/ChapterLinkBlock'
import {CodeBlock} from '../blocks/CodeBlock'
import {CodeVariantsBlock} from '../blocks/CodeVariantsBlock'
import {ExampleBlock} from '../blocks/ExampleBlock'
import {ImageBlock} from '../blocks/ImageBlock'
import {NoticeBlock} from '../blocks/NoticeBlock'

export const textField = () =>
  Field.richText('Body', {
    searchable: true,
    schema: {
      CodeBlock,
      CodeVariantsBlock,
      ImageBlock,
      NoticeBlock,
      ChapterLinkBlock,
      ExampleBlock
    }
  })
