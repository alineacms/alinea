import {Schema, type} from '@alineacms/core'
import {code} from '@alineacms/input.code'

export const CodeBlockSchema = type('Code', {
  code: code('Code', {inline: true})
})

export type CodeBlockSchema = Schema.TypeOf<typeof CodeBlockSchema>
