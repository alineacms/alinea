import {Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'

export const CodeBlockSchema = type(
  'Code',
  tabs(
    tab('Code', {code: code('Code', {inline: true})}),
    tab('Settings', {
      language: text('Language', {width: 0.25})
    })
  )
)

export type CodeBlockSchema = Schema.TypeOf<typeof CodeBlockSchema>
