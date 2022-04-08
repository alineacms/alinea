import {Schema, type} from '@alineacms/core'
import {path} from '@alineacms/input.path'
import {text} from '@alineacms/input.text'

export const DocsPageSchema = type('Docs', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5})
}).configure({isContainer: true, contains: ['Doc', 'Docs']})

export type DocsPageSchema = Schema.TypeOf<typeof DocsPageSchema>
