import {Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'

export const CodeBlockSchema = type('Code', {
  code: code('Code', {inline: true})
})

export type CodeBlockSchema = Schema.TypeOf<typeof CodeBlockSchema>
