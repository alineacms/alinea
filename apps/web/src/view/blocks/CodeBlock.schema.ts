import {Schema, type} from '@alinea/core'
import {code} from '@alinea/input.code'
import {tab, tabs} from '@alinea/input.tabs'
import {text} from '@alinea/input.text'
import {MdCode, MdOutlineSettings} from 'react-icons/md'

export const CodeBlockSchema = type(
  'Code',
  tabs(
    tab('Code', {code: code('Code', {inline: true})}).configure({icon: MdCode}),
    tab('Settings', {
      fileName: text('File name', {width: 0.75}),
      language: text('Language', {width: 0.25})
    }).configure({icon: MdOutlineSettings})
  )
)

export type CodeBlockSchema = Schema.TypeOf<typeof CodeBlockSchema>
