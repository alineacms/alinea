import {schema, Schema, type} from '@alineacms/core'
import {richText} from '@alineacms/input.richtext'
import {CodeBlockSchema} from './CodeBlock.schema'
import {ImageBlockSchema} from './ImageBlock.schema'

export const TextBlockSchema = type('Text', {
  text: richText('Text', {
    blocks: schema({
      CodeBlock: CodeBlockSchema,
      ImageBlock: ImageBlockSchema
    })
  })
})

export type TextBlockSchema = Schema.TypeOf<typeof TextBlockSchema> & {
  id: string
  type: 'TextBlock'
}
