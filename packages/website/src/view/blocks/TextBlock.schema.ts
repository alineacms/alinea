import {schema, Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {CodeBlockSchema} from './CodeBlock.schema'

export const TextBlockSchema = type('Text', {
  text: richText('Text', {
    blocks: schema({
      CodeBlock: CodeBlockSchema
    })
  })
})

export type TextBlockSchema = Schema.TypeOf<typeof TextBlockSchema>
