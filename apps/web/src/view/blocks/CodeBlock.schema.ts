import {Schema, type} from '@alinea/core'
import {check} from '@alinea/input.check'
import {code} from '@alinea/input.code'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'
import {IcOutlineSettings} from '@alinea/ui/icons/IcOutlineSettings'
import {IcRoundCode} from '@alinea/ui/icons/IcRoundCode'
import {transformCode} from './CodeBlock.server'

export const CodeBlockSchema = type(
  'Code',
  tabs(
    tab('Code', {
      code: code('Code', {inline: true, transform: transformCode})
    }).configure({
      icon: IcRoundCode
    }),
    tab('Settings', {
      fileName: text('File name', {width: 0.75}),
      language: text('Language', {width: 0.25}),
      compact: check('Compact', {help: 'Decrease line height'})
    }).configure({icon: IcRoundCode})
  )
).configure({icon: IcOutlineSettings})

export type CodeBlockSchema = Schema.TypeOf<typeof CodeBlockSchema>
