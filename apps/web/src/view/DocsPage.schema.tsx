import {type} from 'alinea/core'
import {path} from 'alinea/input/path'
import {text} from 'alinea/input/text'

export const DocsPageSchema = type('Docs', {
  title: text('Title', {width: 0.5, multiline: true}),
  path: path('Path', {width: 0.5})
}).configure({isContainer: true, contains: ['Doc', 'Docs']})
