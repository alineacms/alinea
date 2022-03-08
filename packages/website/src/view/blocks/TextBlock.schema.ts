import {schema, Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {CodeBlockSchema} from './CodeBlock.schema'
import {ImageBlockSchema} from './ImageBlock.schema'

const blocks = schema({
  CodeBlock: CodeBlockSchema,
  ImageBlock: ImageBlockSchema
})

const text = richText('Text', {
  blocks
})

export const TextBlockSchema = type('Text', {
  text
})

export type TextBlockSchema = Schema.TypeOf<typeof TextBlockSchema>
