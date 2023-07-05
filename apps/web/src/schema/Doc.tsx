import alinea from 'alinea'
import {TextField} from './blocks/TextBlock'

export const Doc = alinea.type('Doc', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5}),
  body: TextField
})
