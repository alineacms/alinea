import {schema, Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {ComponentType} from 'react'
import {ChapterLinkBlockSchema} from './ChapterLinkBlock.schema'
import {CodeBlockSchema} from './CodeBlock.schema'
import {CodeVariantsBlockSchema} from './CodeVariantsBlock.schema'
import {ExampleBlockSchema} from './ExampleBlock.schema'
import {ImageBlockSchema} from './ImageBlock.schema'
import {NoticeBlockSchema} from './NoticeBlock.schema'

export const TextBlockSchema = type('Body text', {
  text: richText('Text', {
    blocks: schema({
      CodeBlock: CodeBlockSchema,
      CodeVariantsBlock: CodeVariantsBlockSchema,
      ImageBlock: ImageBlockSchema,
      NoticeBlock: NoticeBlockSchema,
      ChapterLinkBlock: ChapterLinkBlockSchema,
      ExampleBlock: ExampleBlockSchema
    }),
    inline: true
  })
})

export type TextBlockSchema = Schema.TypeOf<typeof TextBlockSchema> & {
  id: string
  type: 'TextBlock'
  container?: ComponentType
}
